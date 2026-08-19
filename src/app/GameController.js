(function(global){

  const MODE=
    Object.freeze({
      MAINLINE:"mainline",
      DAILY:"daily",
      CUSTOM:"custom"
    });


  class GameController{

    constructor({
      app,
      host
    }){
      this.app=app;
      this.host=host;

      this.mode=
        MODE.MAINLINE;

      this.level=1;
      this.levelData=null;

      this.initialState=null;
      this.state=null;

      this.history=
        new global.History();

      /*
        History 可能因为“+瓶子”被清空，
        所以步数不能再直接等于 history.length。
      */
      this.moveCount=0;

      this.selected=-1;
      this.hintMove=null;

      this.sourceLocks=
        new Set();

      this.targetGroups=
        new Map();

      this.runningAnimations=
        new Set();

      this.nextFlowId=1;

      this.extraBottleUsed=false;

      this.winHandled=false;

      this.progress=
        new global.ProgressStore();

      /*
        声音开关从 ProgressStore 恢复，
        刷新页面后保持上次状态。
      */
      this.soundOn=
        this.progress.soundEnabled;

      this.board=
        new global.BoardRenderer({
          app,
          host,

          onBottleTap:
            index=>
              this.handleBottleTap(
                index
              )
        });

      this.animator=
        new global.PourAnimator({
          board:this.board
        });

      this.audioContext=null;

      /*
        倒水声音使用 Web Audio 动态合成，
        不需要额外 mp3 / wav 资源。

        每条并发水流拥有一个独立 noise source，
        最后汇入同一个 compressor，
        多瓶同时倒时不会把总音量简单叠爆。
      */
      this.waterNoiseBuffer=null;
      this.pourMasterGain=null;
      this.pourCompressor=null;
      this.pourSounds=
        new Map();

      this.bindUI();


      /*
        即使页面跨午夜一直开着，
        每分钟也会检查一次 daily date。
      */
      this.dailyTimer=
        setInterval(
          ()=>{

            if(
              this.progress
                .refreshDaily()
            ){
              this.updateMetaUI();
            }
          },
          60000
        );
    }


    /* =========================================================
       模式
       ========================================================= */

    isDaily(){
      return(
        this.mode===
        MODE.DAILY
      );
    }

    isMainline(){
      return(
        this.mode===
        MODE.MAINLINE
      );
    }

    isCustom(){
      return(
        this.mode===
        MODE.CUSTOM
      );
    }

    boostsAllowed(){
      return(
        !this.isDaily()
      );
    }

    modeLabel(){

      if(this.isDaily()){
        return "每日·极难";
      }

      if(this.isCustom()){
        return `挑战 ${this.level}`;
      }

      return `主线 ${this.level}`;
    }


    /* =========================================================
       并发
       ========================================================= */

    isSourceLocked(index){
      return this.sourceLocks.has(index);
    }

    isReceiving(index){
      return this.targetGroups.has(index);
    }

    canUseAsSource(index){
      return(
        !this.isSourceLocked(index) &&
        !this.isReceiving(index)
      );
    }

    canUseAsTarget(index){
      return(
        !this.isSourceLocked(index)
      );
    }

    hasRunningAnimations(){
      return(
        this.runningAnimations.size>0
      );
    }

    createFlowId(){
      return(
        `pour-${this.nextFlowId++}`
      );
    }


    /* =========================================================
       多路目标聚合
       ========================================================= */

    registerTargetFlow(
      targetIndex,
      flowId,
      color,
      amount,
      targetBefore
    ){

      let group=
        this.targetGroups.get(
          targetIndex
        );


      if(!group){

        group={
          baseState:
            targetBefore.slice(),

          color,

          flows:
            new Map()
        };

        this.targetGroups.set(
          targetIndex,
          group
        );

        this.board
          .actor(targetIndex)
          .setState(
            group.baseState
          );
      }


      if(
        group.color!==color
      ){
        throw new Error(
          "并发目标流颜色不一致"
        );
      }


      group.flows.set(
        flowId,
        {
          amount,
          progress:0
        }
      );


      this.renderTargetGroup(
        targetIndex
      );
    }


    updateTargetFlow(
      targetIndex,
      flowId,
      progress
    ){

      const group=
        this.targetGroups.get(
          targetIndex
        );

      if(!group){
        return;
      }

      const flow=
        group.flows.get(
          flowId
        );

      if(!flow){
        return;
      }

      flow.progress=
        Math.max(
          0,
          Math.min(
            1,
            progress
          )
        );

      this.renderTargetGroup(
        targetIndex
      );
    }


    renderTargetGroup(
      targetIndex
    ){

      const group=
        this.targetGroups.get(
          targetIndex
        );

      if(!group){
        return;
      }

      let incomingAmount=0;

      for(
        const flow
        of group.flows.values()
      ){
        incomingAmount+=
          flow.amount*
          flow.progress;
      }

      this.board
        .actor(targetIndex)
        .previewTargetAggregate(
          group.baseState,
          group.color,
          incomingAmount
        );
    }


    completeTargetFlow(
      targetIndex,
      flowId
    ){

      const group=
        this.targetGroups.get(
          targetIndex
        );

      if(!group){
        return;
      }

      const flow=
        group.flows.get(
          flowId
        );

      if(!flow){
        return;
      }


      for(
        let i=0;
        i<flow.amount;
        i++
      ){
        group.baseState.push(
          group.color
        );
      }

      group.flows.delete(
        flowId
      );


      if(
        group.flows.size===0
      ){

        this.targetGroups.delete(
          targetIndex
        );

        this.board
          .actor(targetIndex)
          .setState(
            this.state.bottle(
              targetIndex
            )
          );

        return;
      }


      this.renderTargetGroup(
        targetIndex
      );
    }


    forceFinishTargetFlow(
      targetIndex,
      flowId
    ){

      const group=
        this.targetGroups.get(
          targetIndex
        );

      if(
        group &&
        group.flows.has(
          flowId
        )
      ){
        this.completeTargetFlow(
          targetIndex,
          flowId
        );
      }
    }


    /* =========================================================
       UI helpers
       ========================================================= */

    setMessage(text){

      document.getElementById(
        "message"
      ).textContent=text;
    }


    hideWin(){

      document.getElementById(
        "winModal"
      ).classList.add(
        "hidden"
      );
    }


    hideCustomModal(){

      document.getElementById(
        "customModal"
      ).classList.add(
        "hidden"
      );
    }


    updateMetaUI(){

      this.progress.refreshDaily();

      document.getElementById(
        "mainlineLevelText"
      ).textContent=
        `第 ${this.progress.mainlineLevel} 关`;


      document.getElementById(
        "dailyStateText"
      ).textContent=
        this.progress.dailyCompleted
          ?"今日已完成 · 可重玩"
          :"极难 · 10–100";


      document.getElementById(
        "pointsText"
      ).textContent=
        this.progress.points;


      document.getElementById(
        "modeText"
      ).textContent=
        this.modeLabel();


      document.getElementById(
        "movesText"
      ).textContent=
        this.moveCount;


      document.getElementById(
        "mainlineBtn"
      ).classList.toggle(
        "active",
        this.isMainline()
      );

      document.getElementById(
        "dailyBtn"
      ).classList.toggle(
        "active",
        this.isDaily()
      );

      document.getElementById(
        "customBtn"
      ).classList.toggle(
        "active",
        this.isCustom()
      );


      const sound=
        this.soundOn
          ?"🔊"
          :"🔇";

      document.getElementById(
        "soundBtn"
      ).textContent=
        sound;

      document.getElementById(
        "soundBtnMobile"
      ).textContent=
        sound;
    }


    render(){

      this.progress.refreshDaily();

      const actorCountChanged=
        this.board.ensureActorCount(
          this.state.bottleCount
        );


      for(
        let i=0;
        i<this.state.bottleCount;
        i++
      ){

        const actor=
          this.board.actor(i);


        if(
          !this.isSourceLocked(i) &&
          !this.isReceiving(i)
        ){
          actor.setState(
            this.state.bottle(i)
          );
        }


        actor.setSelected(
          i===this.selected
        );


        actor.root.alpha=
          this.isSourceLocked(i)
            ?.78
            :1;


        if(
          this.hintMove &&
          (
            i===this.hintMove[0] ||
            i===this.hintMove[1]
          ) &&
          !this.isSourceLocked(i)
        ){
          actor.root.alpha=.72;
        }
      }


      /*
        先更新 DOM 文本，再决定是否需要布局。

        旧版是：
          board.layout()
          → updateMetaUI()

        首次进入时 DOM 行高可能在 layout 之后才稳定，
        第一次点击再次 layout 就会让全体瓶子跳一下。
      */

      this.updateMetaUI();


      if(actorCountChanged){
        this.board.layoutDirty=true;
      }


      this.board.layoutIfNeeded();


      const globalLocked=
        this.hasRunningAnimations();


      document.getElementById(
        "undoBtn"
      ).disabled=
        globalLocked ||
        !this.history.canUndo;


      document.getElementById(
        "redoBtn"
      ).disabled=
        globalLocked ||
        !this.history.canRedo;


      document.getElementById(
        "resetBtn"
      ).disabled=
        globalLocked;


      document.getElementById(
        "extraBottleBtn"
      ).disabled=
        globalLocked ||
        !this.boostsAllowed() ||
        this.extraBottleUsed ||
        this.progress.points<
        global.SODA_CONFIG
          .economy
          .extraBottleCost;


      document.getElementById(
        "hintBtn"
      ).disabled=
        !this.boostsAllowed() ||
        this.progress.points<
        global.SODA_CONFIG
          .economy
          .hintCost;


    }


    /* =========================================================
       Sound
       ========================================================= */

    ensureAudioContext(){

      try{

        this.audioContext||=
          new(
            window.AudioContext||
            window.webkitAudioContext
          )();


        /*
          手机 Safari / Chrome 可能处于 suspended。
          这里不会等待 Promise，用户点击操作后浏览器会允许恢复。
        */
        if(
          this.audioContext.state===
          "suspended"
        ){
          this.audioContext
            .resume()
            .catch(()=>{});
        }


        return(
          this.audioContext
        );
      }
      catch{

        return null;
      }
    }


    beep(
      frequency=420,
      duration=.05,
      volume=.018
    ){

      if(!this.soundOn){
        return;
      }


      const ctx=
        this.ensureAudioContext();


      if(!ctx){
        return;
      }


      try{

        const oscillator=
          ctx.createOscillator();

        const gain=
          ctx.createGain();


        oscillator.frequency.value=
          frequency;


        gain.gain.value=
          volume;


        oscillator.connect(
          gain
        );


        gain.connect(
          ctx.destination
        );


        oscillator.start();


        gain.gain
          .exponentialRampToValueAtTime(
            .0001,
            ctx.currentTime+
            duration
          );


        oscillator.stop(
          ctx.currentTime+
          duration
        );
      }
      catch{}
    }


    playSelect(){

      this.beep(
        550,
        .045,
        .014
      );
    }


    /*
      倒水开头直接复用“点击瓶子”的清脆声。

      这个声音非常短，
      更像液体刚越过瓶口时的第一下“嗒/啵”，
      后面再接 glug 脉冲。
    */
    playPourStart(){

      this.beep(
        550,
        .045,
        .014
      );
    }


    playWin(){

      [523,659,784]
        .forEach(
          (frequency,index)=>
            setTimeout(
              ()=>
                this.beep(
                  frequency,
                  .13,
                  .026
                ),
              index*105
            )
        );
    }


    /* ---------------------------------------------------------
       倒水声音
       --------------------------------------------------------- */

    ensurePourAudioGraph(){

      const ctx=
        this.ensureAudioContext();


      if(!ctx){
        return null;
      }


      /*
        “吨吨吨 / 咕噜咕噜”不是持续白噪声，
        而是瓶内空气周期性回灌造成的压力脉冲。

        因此这里不再生成持续 waterNoiseBuffer 作为主体。
        只建立一个很轻的总线 + compressor，
        每一次 glug 都临时生成一个短促共鸣脉冲。
      */
      if(!this.pourMasterGain){

        this.pourMasterGain=
          ctx.createGain();


        this.pourCompressor=
          ctx.createDynamicsCompressor();


        /*
          只做并发保护，不把单次 glug 顶得很响。
        */
        this.pourCompressor
          .threshold
          .setValueAtTime(
            -18,
            ctx.currentTime
          );


        this.pourCompressor
          .knee
          .setValueAtTime(
            8,
            ctx.currentTime
          );


        this.pourCompressor
          .ratio
          .setValueAtTime(
            2.4,
            ctx.currentTime
          );


        this.pourCompressor
          .attack
          .setValueAtTime(
            .006,
            ctx.currentTime
          );


        this.pourCompressor
          .release
          .setValueAtTime(
            .16,
            ctx.currentTime
          );


        this.pourMasterGain
          .gain
          .setValueAtTime(
            .58,
            ctx.currentTime
          );


        this.pourMasterGain
          .connect(
            this.pourCompressor
          );


        this.pourCompressor
          .connect(
            ctx.destination
          );
      }


      return ctx;
    }


    createPourSound(
      flowId
    ){

      if(
        this.pourSounds.has(
          flowId
        )
      ){
        return(
          this.pourSounds.get(
            flowId
          )
        );
      }


      const ctx=
        this.ensurePourAudioGraph();


      if(
        !ctx ||
        !this.soundOn
      ){
        return null;
      }


      /*
        每条倒水流只保存“下一次吨声的时间”等状态。
        真正的声音节点每个脉冲临时创建，播放完自动释放。
      */
      const sound={
        /*
          第一声 glug 可以直接开始。
          音高本身会调整到接近点击声的 550Hz 区域。
        */
        nextGlugTime:
          ctx.currentTime,

        lastStrength:0,

        /*
          每条流略微不同，多个瓶子同时倒时不会完全同步。
        */
        pitchJitter:
          Math.random()*.014-.007,

        timingJitter:
          Math.random()*.025
      };


      this.pourSounds.set(
        flowId,
        sound
      );


      return sound;
    }


    playGlugPulse(
      sound,
      strength
    ){

      const ctx=
        this.ensurePourAudioGraph();


      if(!ctx){
        return;
      }


      const s=
        Math.max(
          0,
          Math.min(
            1,
            strength
          )
        );


      const now=
        ctx.currentTime;


      /*
        =========================================================
        研究导向的 bottle glug 合成

        不使用 oscillator。
        不使用滑音。
        不用 click / tick。

        每一次“吨”：
        1. 一小段宽频液体/空气脉冲
        2. 经过 300~600 Hz 的大气泡共鸣
        3. 再叠极轻的 1.5~3 kHz 小气泡成分

        这样声音来自“被共鸣塑形的瞬态噪声”，
        而不是一个电子乐音。
        =========================================================
      */


      /* ---------------------------------------------------------
         创建一次短促的液体/空气脉冲
         --------------------------------------------------------- */

      const duration=
        .145;


      const sampleCount=
        Math.max(
          64,
          Math.floor(
            ctx.sampleRate*
            duration
          )
        );


      const buffer=
        ctx.createBuffer(
          1,
          sampleCount,
          ctx.sampleRate
        );


      const data=
        buffer.getChannelData(
          0
        );


      /*
        两级平滑：
        保留宽频瞬态，
        但去掉纯白噪声那种“嘶”。
      */
      let slow=0;
      let fast=0;


      for(
        let i=0;
        i<data.length;
        i++
      ){

        const t=
          i/
          data.length;


        const white=
          Math.random()*2-1;


        slow=
          slow*.84+
          white*.16;


        fast=
          fast*.42+
          white*.58;


        /*
          包络：
          - 约 8ms 软起音
          - 之后快速但圆滑衰减

          这会形成“吨”的短促气泡脉冲，
          而不是“哒”的硬敲击。
        */
        const attack=
          Math.min(
            1,
            t/.06
          );


        const decay=
          Math.pow(
            1-t,
            2.55
          );


        data[i]=
          (
            slow*.72+
            fast*.28
          )*
          attack*
          decay*
          .38;
      }


      const source=
        ctx.createBufferSource();

      source.buffer=
        buffer;


      /* ---------------------------------------------------------
         大气泡主体：约 300~600 Hz

         Q 不要太高：
         Q 高了会重新变成电子“嗡”声。
         --------------------------------------------------------- */

      const largeBubbleFilter=
        ctx.createBiquadFilter();

      largeBubbleFilter.type=
        "bandpass";


      /*
        大流量时气泡通常更大一些，
        因此这里只做很轻的向低频偏移。

        不是滑音：
        每一整个 glug 内频率是固定的。
      */
      const largeBubbleFreq=
        (
          520-
          105*s+
          (
            Math.random()-.5
          )*34
        )*
        (
          1+
          sound.pitchJitter*.45
        );


      largeBubbleFilter.frequency
        .setValueAtTime(
          Math.max(
            320,
            Math.min(
              590,
              largeBubbleFreq
            )
          ),
          now
        );


      largeBubbleFilter.Q
        .setValueAtTime(
          1.35+
          .22*s,
          now
        );


      const largeBubbleGain=
        ctx.createGain();


      largeBubbleGain.gain
        .setValueAtTime(
          .022+
          .012*s,
          now
        );


      /* ---------------------------------------------------------
         小气泡细节：约 1.5~3 kHz

         音量非常低，只负责一点真实的“咕噜颗粒”，
         不能成为主体。
         --------------------------------------------------------- */

      const smallBubbleFilter=
        ctx.createBiquadFilter();

      smallBubbleFilter.type=
        "bandpass";


      smallBubbleFilter.frequency
        .setValueAtTime(
          1750+
          620*Math.random()+
          180*s,
          now
        );


      smallBubbleFilter.Q
        .setValueAtTime(
          .82,
          now
        );


      const smallBubbleGain=
        ctx.createGain();


      smallBubbleGain.gain
        .setValueAtTime(
          .0022+
          .0022*s,
          now
        );


      /* ---------------------------------------------------------
         再加一个低通，避免手机扬声器出现“炸裂”高频。
         --------------------------------------------------------- */

      const safetyLowpass=
        ctx.createBiquadFilter();

      safetyLowpass.type=
        "lowpass";


      safetyLowpass.frequency
        .setValueAtTime(
          3300,
          now
        );


      safetyLowpass.Q
        .setValueAtTime(
          .45,
          now
        );


      /*
        一个 source 分成两路：
        - 大气泡主体
        - 小气泡细节
      */

      source.connect(
        largeBubbleFilter
      );


      largeBubbleFilter.connect(
        largeBubbleGain
      );


      largeBubbleGain.connect(
        safetyLowpass
      );


      source.connect(
        smallBubbleFilter
      );


      smallBubbleFilter.connect(
        smallBubbleGain
      );


      smallBubbleGain.connect(
        safetyLowpass
      );


      safetyLowpass.connect(
        this.pourMasterGain
      );


      source.start(
        now
      );


      /*
        节点释放。
      */
      setTimeout(
        ()=>{

          try{
            source.disconnect();

            largeBubbleFilter.disconnect();
            largeBubbleGain.disconnect();

            smallBubbleFilter.disconnect();
            smallBubbleGain.disconnect();

            safetyLowpass.disconnect();
          }
          catch{}
        },
        230
      );
    }

    updatePourSound(
      flowId,
      strength
    ){

      const s=
        Math.max(
          0,
          Math.min(
            1,
            Number(strength)||0
          )
        );


      if(!this.soundOn){

        this.stopPourSound(
          flowId
        );

        return;
      }


      if(
        s<=0.001
      ){

        this.stopPourSound(
          flowId
        );

        return;
      }


      const ctx=
        this.ensurePourAudioGraph();


      if(!ctx){
        return;
      }


      const sound=
        this.createPourSound(
          flowId
        );


      if(!sound){
        return;
      }


      const now=
        ctx.currentTime;


      /*
        第一帧真实水流：
        播一次与瓶子点击相同的清脆声。

        只触发一次，不会每帧重复。
      */
      if(!sound.started){

        sound.started=true;

        this.playPourStart();

        /*
          确保第一声 glug 不和点击声叠在一起，
          留出一点非常短的“液体冲出瓶口”间隔。
        */
        sound.nextGlugTime=
          now+.055;
      }


      sound.lastStrength=s;


      /*
        真正的“吨吨吨”节奏：

        流量大：
          间隔约 135~155ms

        中等：
          约 175~210ms

        刚开始 / 尾流：
          约 240~320ms

        因此不会像固定节拍器。
      */
      const interval=
        (
          .315-
          .125*
          Math.pow(
            s,
            .70
          )
        )+
        sound.timingJitter;


      if(
        now>=
        sound.nextGlugTime
      ){

        this.playGlugPulse(
          sound,
          s
        );


        /*
          每次再加一点随机浮动，
          否则“吨吨吨”会过于机械。
        */
        const randomOffset=
          (
            Math.random()-.5
          )*
          .010;


        sound.nextGlugTime=
          now+
          Math.max(
            .180,
            interval+
            randomOffset
          );
      }
    }


    stopPourSound(
      flowId
    ){

      /*
        这里没有持续 BufferSource 需要淡出。
        每个 glug pulse 本身只有约 100ms，
        停止新脉冲即可自然结束。
      */
      this.pourSounds.delete(
        flowId
      );
    }


    stopAllPourSounds(){

      for(
        const flowId
        of[
          ...this.pourSounds.keys()
        ]
      ){
        this.stopPourSound(
          flowId
        );
      }
    }


    /* =========================================================
       Load modes
       ========================================================= */

    resetRunState(){

      this.history.clear();

      this.moveCount=0;

      this.selected=-1;
      this.hintMove=null;

      this.sourceLocks.clear();
      this.targetGroups.clear();
      this.runningAnimations.clear();

      this.extraBottleUsed=false;

      this.winHandled=false;

      this.hideWin();
    }


    loadMainline(){

      if(this.hasRunningAnimations()){
        this.setMessage(
          "还有瓶子正在倒水。"
        );
        return;
      }

      this.mode=
        MODE.MAINLINE;

      this.level=
        this.progress.mainlineLevel;

      this.levelData=
        global.LevelGenerator.generate(
          this.level
        );

      this.initialState=
        new global.GameState(
          this.levelData.bottles
        );

      this.state=
        this.initialState.clone();

      this.resetRunState();

      this.render();

      this.setMessage(
        `主线第 ${this.level} 关 · 进度已自动保存。`
      );
    }


    loadDaily(){

      if(this.hasRunningAnimations()){
        this.setMessage(
          "还有瓶子正在倒水。"
        );
        return;
      }

      this.progress.refreshDaily();

      this.mode=
        MODE.DAILY;

      const key=
        global.DailyChallenge
          .localDateKey();

      this.level=key;

      this.levelData=
        global.DailyChallenge
          .generate(
            key
          );

      this.initialState=
        new global.GameState(
          this.levelData.bottles
        );

      this.state=
        this.initialState.clone();

      this.resetRunState();

      this.render();

      this.setMessage(
        this.progress.dailyCompleted
          ?"今日挑战已结算过积分，可以继续重玩，但不会再次获得积分。"
          :"每日极难挑战：禁用加瓶和提示，首次完成按步数奖励 10～100 积分。"
      );
    }


    openCustomChallenge(){

      if(this.hasRunningAnimations()){
        return;
      }

      const cost=
        global.SODA_CONFIG
          .economy
          .customChallengeCost;

      if(
        this.progress.points<
        cost
      ){
        this.setMessage(
          `指定挑战需要 ${cost} 积分。`
        );
        return;
      }

      document.getElementById(
        "customLevelInput"
      ).value=
        this.progress.mainlineLevel;

      document.getElementById(
        "customModal"
      ).classList.remove(
        "hidden"
      );

      setTimeout(
        ()=>
          document.getElementById(
            "customLevelInput"
          ).select(),
        0
      );
    }


    confirmCustomChallenge(){

      const level=
        Math.max(
          1,
          Math.floor(
            Number(
              document.getElementById(
                "customLevelInput"
              ).value
            )||1
          )
        );


      const cost=
        global.SODA_CONFIG
          .economy
          .customChallengeCost;


      if(
        !this.progress
          .spendPoints(
            cost
          )
      ){
        this.hideCustomModal();

        this.setMessage(
          "积分不足。"
        );

        this.render();

        return;
      }


      this.hideCustomModal();

      this.mode=
        MODE.CUSTOM;

      this.level=level;

      this.levelData=
        global.LevelGenerator
          .generate(
            level
          );

      this.initialState=
        new global.GameState(
          this.levelData.bottles
        );

      this.state=
        this.initialState.clone();

      this.resetRunState();

      this.render();

      this.setMessage(
        `指定挑战：第 ${level} 关。通关不会修改主线记录。`
      );
    }


    /* =========================================================
       Paid boosts
       ========================================================= */

    buyExtraBottle(){

      if(
        !this.boostsAllowed()
      ){
        this.setMessage(
          "每日挑战禁止加瓶。"
        );
        return;
      }


      if(
        this.hasRunningAnimations()
      ){
        return;
      }


      if(this.extraBottleUsed){

        this.setMessage(
          "本局已经增加过一个空瓶。"
        );

        return;
      }


      const cost=
        global.SODA_CONFIG
          .economy
          .extraBottleCost;


      if(
        !this.progress
          .spendPoints(
            cost
          )
      ){
        this.setMessage(
          "积分不足。"
        );
        return;
      }


      /*
        结构发生变化后，旧 MoveCommand 的 state.key()
        已不兼容，因此清空 undo/redo。

        moveCount 独立保存，不会被清零。
      */
      this.history.clear();


      const stateBottles=
        this.state.toArray();

      stateBottles.push([]);

      this.state=
        new global.GameState(
          stateBottles
        );


      const initialBottles=
        this.initialState.toArray();

      initialBottles.push([]);

      this.initialState=
        new global.GameState(
          initialBottles
        );


      this.extraBottleUsed=true;

      this.render();

      this.setMessage(
        `已消耗 ${cost} 积分，增加 1 个空瓶。本局重置后仍保留。`
      );
    }


    buyHint(){

      if(
        !this.boostsAllowed()
      ){
        this.setMessage(
          "每日挑战禁止提示。"
        );
        return;
      }


      const moves=
        global.SodaRules
          .legalMoves(
            this.state
          )
          .filter(
            plan=>
              this.canUseAsSource(
                plan.from
              ) &&
              this.canUseAsTarget(
                plan.to
              )
          );


      if(!moves.length){

        this.setMessage(
          "当前没有可执行的合法移动。"
        );

        return;
      }


      const cost=
        global.SODA_CONFIG
          .economy
          .hintCost;


      if(
        !this.progress
          .spendPoints(
            cost
          )
      ){
        this.setMessage(
          "积分不足。"
        );
        return;
      }


      /*
        使用原 HintEngine 的评分逻辑。
        如果它挑到正在忙的瓶子，
        再退回当前可用候选第一项。
      */

      let plan=
        global.HintEngine
          .bestMove(
            this.state
          );


      if(
        !plan ||
        !this.canUseAsSource(
          plan.from
        ) ||
        !this.canUseAsTarget(
          plan.to
        )
      ){
        plan=
          moves[0];
      }


      this.hintMove=[
        plan.from,
        plan.to
      ];

      this.render();

      this.setMessage(
        `提示：${plan.from+1} → ${plan.to+1}（-${cost} 积分）`
      );


      setTimeout(
        ()=>{

          if(this.hintMove){
            this.hintMove=null;
            this.render();
          }
        },
        1700
      );
    }


    /* =========================================================
       Move
       ========================================================= */

    reasonText(reason){

      const R=
        global.SodaRules.REASON;

      if(reason===R.SOURCE_EMPTY){
        return "空瓶不能作为倒水起点";
      }

      if(reason===R.TARGET_FULL){
        return "目标瓶已经满了";
      }

      if(reason===R.COLOR_MISMATCH){
        return "目标瓶顶部颜色不同";
      }

      if(reason===R.SAME_BOTTLE){
        return "已经取消选择";
      }

      return "这个移动不能执行";
    }


    async handleBottleTap(index){

      this.hintMove=null;


      if(this.selected<0){

        if(
          !this.canUseAsSource(
            index
          )
        ){
          this.setMessage(
            this.isReceiving(index)
              ?`瓶子 ${index+1} 正在接水。`
              :`瓶子 ${index+1} 正在倒水。`
          );
          return;
        }


        if(
          this.state.isEmpty(
            index
          )
        ){
          this.setMessage(
            "空瓶不能作为倒水起点。"
          );
          return;
        }


        this.selected=index;

        this.playSelect();
        this.render();

        return;
      }


      if(
        !this.canUseAsSource(
          this.selected
        )
      ){
        this.selected=-1;
        this.render();
        return;
      }


      if(
        this.selected===index
      ){
        this.selected=-1;
        this.render();
        return;
      }


      if(
        !this.canUseAsTarget(
          index
        )
      ){
        this.setMessage(
          `瓶子 ${index+1} 正在作为源瓶倒水。`
        );
        return;
      }


      const sourceIndex=
        this.selected;

      const targetIndex=
        index;


      const command=
        new global.MoveCommand(
          this.state,
          sourceIndex,
          targetIndex
        );


      if(!command.valid){

        const message=
          this.reasonText(
            command.plan.reason
          );


        this.selected=
          (
            !this.state.isEmpty(index) &&
            this.canUseAsSource(index)
          )
            ?index
            :-1;


        this.playSelect();
        this.render();

        this.setMessage(
          message
        );

        return;
      }


      const color=
        command.plan.color;

      const amount=
        command.plan.amount;

      const flowId=
        this.createFlowId();


      const sourceActor=
        this.board.actor(
          sourceIndex
        );


      const sourceBefore=
        this.state.bottle(
          sourceIndex
        ).slice();


      const targetBefore=
        this.state.bottle(
          targetIndex
        ).slice();


      this.sourceLocks.add(
        sourceIndex
      );


      this.registerTargetFlow(
        targetIndex,
        flowId,
        color,
        amount,
        targetBefore
      );


      this.selected=-1;


      /*
        立即占用逻辑容量，
        使多个源瓶同时往一个目标倒时仍然安全。
      */

      this.state=
        command.execute(
          this.state
        );

      this.history.commit(
        command
      );

      this.moveCount++;


      sourceActor.setState(
        sourceBefore
      );


      this.render();


      let targetCompleted=false;


      /*
        第二次点瓶子属于用户手势。
        这里提前 resume，可避免某些手机浏览器等到真正出水时
        才发现 AudioContext 仍是 suspended。
      */
      if(this.soundOn){
        this.ensureAudioContext();
      }


      const animationPromise=
        this.animator.play({
          sourceIndex,
          targetIndex,
          flowId,
          color,
          amount,

          onTargetProgress:
            progress=>
              this.updateTargetFlow(
                targetIndex,
                flowId,
                progress
              ),

          /*
            水声与真实瞬时流量同步。
            多瓶并发时每个 flowId 独立播放。
          */
          onFlowStrength:
            strength=>
              this.updatePourSound(
                flowId,
                strength
              ),

          onCommit:()=>{

            sourceActor.setState(
              this.state.bottle(
                sourceIndex
              )
            );

            this.completeTargetFlow(
              targetIndex,
              flowId
            );

            targetCompleted=true;
          }
        });


      this.runningAnimations.add(
        animationPromise
      );


      try{

        await animationPromise;
      }
      finally{

        this.runningAnimations.delete(
          animationPromise
        );

        this.sourceLocks.delete(
          sourceIndex
        );


        if(!targetCompleted){

          this.forceFinishTargetFlow(
            targetIndex,
            flowId
          );
        }


        sourceActor.setState(
          this.state.bottle(
            sourceIndex
          )
        );


        this.render();


        if(
          !this.hasRunningAnimations()
        ){
          this.checkWin();
        }
      }
    }


    /* =========================================================
       Win / auto save
       ========================================================= */

    checkWin(){

      if(
        this.winHandled ||
        !global.SodaRules.isSolved(
          this.state
        )
      ){
        return;
      }


      this.winHandled=true;


      const stars=
        global.SodaDifficulty.stars(
          this.moveCount,
          this.levelData.par
        );


      let rewardText="";
      let nextButtonText=
        "返回主线";


      if(this.isMainline()){

        const next=
          this.progress.advanceMainline(
            this.level
          );

        rewardText=
          `主线进度已自动保存：第 ${next} 关`;

        nextButtonText=
          "下一关";
      }
      else if(this.isDaily()){

        /*
          每日挑战积分只看当天第一次完成时的步数。
          重玩仍然允许，但 ProgressStore.completeDaily()
          会阻止第二次积分结算。
        */
        const dailyScore=
          global.DailyChallenge
            .scoreBySteps(
              this.moveCount,
              this.levelData.par
            );


        const result=
          this.progress.completeDaily(
            dailyScore
          );


        rewardText=
          result.rewarded
            ?`每日挑战完成：${this.moveCount} 步，获得 ${dailyScore} 积分`
            :"今日积分已领取，本次重玩不再获得积分";

        nextButtonText=
          "返回主线";
      }
      else{

        rewardText=
          "指定挑战完成，不修改主线记录";

        nextButtonText=
          "返回主线";
      }


      document.getElementById(
        "winTitle"
      ).textContent=
        this.isDaily()
          ?"每日挑战完成"
          :this.isCustom()
            ?"挑战完成"
            :"主线完成";


      document.getElementById(
        "starsText"
      ).textContent=
        "⭐".repeat(stars)+
        "☆".repeat(3-stars);


      document.getElementById(
        "resultText"
      ).textContent=
        `${this.modeLabel()} · ${this.moveCount} 步`;


      document.getElementById(
        "rewardText"
      ).textContent=
        rewardText;


      document.getElementById(
        "nextLevelBtn"
      ).textContent=
        nextButtonText;


      this.playWin();

      this.render();


      setTimeout(
        ()=>{

          document.getElementById(
            "winModal"
          ).classList.remove(
            "hidden"
          );
        },
        140
      );
    }


    /* =========================================================
       Undo / redo / reset
       ========================================================= */

    undo(){

      if(
        this.hasRunningAnimations() ||
        !this.history.canUndo
      ){
        return;
      }


      this.selected=-1;
      this.hintMove=null;


      this.state=
        this.history.undo(
          this.state
        );


      this.moveCount=
        Math.max(
          0,
          this.moveCount-1
        );


      this.winHandled=false;

      this.render();

      this.setMessage(
        "已撤销一步。"
      );
    }


    redo(){

      if(
        this.hasRunningAnimations() ||
        !this.history.canRedo
      ){
        return;
      }


      this.selected=-1;
      this.hintMove=null;


      this.state=
        this.history.redo(
          this.state
        );


      this.moveCount++;


      this.render();

      this.setMessage(
        "已重做一步。"
      );


      this.checkWin();
    }


    reset(){

      if(
        this.hasRunningAnimations()
      ){
        return;
      }


      this.hideWin();

      this.history.clear();

      this.state=
        this.initialState.clone();

      this.moveCount=0;

      this.selected=-1;
      this.hintMove=null;

      this.sourceLocks.clear();
      this.targetGroups.clear();

      this.winHandled=false;

      this.render();

      this.setMessage(
        this.extraBottleUsed
          ?"已重置，本局购买的额外空瓶保留。"
          :"关卡已重置。"
      );
    }


    replayCurrent(){

      this.reset();
    }


    nextAfterWin(){

      this.hideWin();

      if(this.isMainline()){

        this.loadMainline();
      }
      else{

        this.loadMainline();
      }
    }


    /* =========================================================
       Bind
       ========================================================= */

    bindUI(){

      document.getElementById(
        "mainlineBtn"
      ).onclick=
        ()=>this.loadMainline();


      document.getElementById(
        "dailyBtn"
      ).onclick=
        ()=>this.loadDaily();


      document.getElementById(
        "customBtn"
      ).onclick=
        ()=>this.openCustomChallenge();


      document.getElementById(
        "undoBtn"
      ).onclick=
        ()=>this.undo();


      document.getElementById(
        "redoBtn"
      ).onclick=
        ()=>this.redo();


      document.getElementById(
        "extraBottleBtn"
      ).onclick=
        ()=>this.buyExtraBottle();


      document.getElementById(
        "hintBtn"
      ).onclick=
        ()=>this.buyHint();


      document.getElementById(
        "resetBtn"
      ).onclick=
        ()=>this.reset();


      const toggleSound=
        ()=>{

          this.soundOn=
            this.progress.toggleSound();


          if(this.soundOn){

            /*
              用户点击本身就是合法的 audio gesture，
              在这里主动恢复 AudioContext。
            */
            this.ensureAudioContext();
          }
          else{

            /*
              如果正在同时倒多瓶水，
              关闭声音后全部水声立即淡出。
            */
            this.stopAllPourSounds();
          }


          this.updateMetaUI();
        };


      document.getElementById(
        "soundBtn"
      ).onclick=
        toggleSound;


      document.getElementById(
        "soundBtnMobile"
      ).onclick=
        toggleSound;


      document.getElementById(
        "replayBtn"
      ).onclick=
        ()=>this.replayCurrent();


      document.getElementById(
        "nextLevelBtn"
      ).onclick=
        ()=>this.nextAfterWin();


      document.getElementById(
        "cancelCustomBtn"
      ).onclick=
        ()=>this.hideCustomModal();


      document.getElementById(
        "confirmCustomBtn"
      ).onclick=
        ()=>this.confirmCustomChallenge();


      document.getElementById(
        "customLevelInput"
      ).addEventListener(
        "keydown",
        event=>{

          if(event.key==="Enter"){
            this.confirmCustomChallenge();
          }
        }
      );


      document.getElementById(
        "customModal"
      ).addEventListener(
        "pointerdown",
        event=>{

          if(
            event.target.id===
            "customModal"
          ){
            this.hideCustomModal();
          }
        }
      );
    }


    start(){
      this.loadMainline();
    }
  }


  global.GameController=
    GameController;

})(window);
