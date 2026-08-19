(function(global){

  /*
    ============================================================
    自动保存
    ============================================================

    新版每日挑战需要“每关完成立即结算”，因此必须保存每一关
    是否已经领取过积分，否则刷新页面后会重复领奖。

    保存结构：

    {
      mainlineLevel,
      points,

      daily:{
        date,

        // 兼容旧版本；实际值会根据 completedStages 自动同步
        completed,

        // 当天已经首次通关并领取过奖励的关卡
        completedStages:[1,2,...],

        // 当天各关首次通关时实际领取的积分
        stageRewards:{
          "1":10,
          "2":18
        }
      },

      soundEnabled
    }

    不保存：
    - 当前棋盘
    - 当前步数
    - 重玩成绩
    - Undo/Redo
    - 指定挑战
    - 道具使用状态

    每天日期变化时：
      completedStages / stageRewards 自动清空。
  */


  const KEY=
    "SODA_SEQUENCE_SAVE_V1";


  function todayKey(){

    return global
      .DailyChallenge
      .localDateKey();
  }


  function stageCount(){

    return Math.max(
      1,
      Math.floor(
        Number(
          global
            .DailyChallenge
            .STAGE_COUNT
        )||1
      )
    );
  }


  function allStages(){

    return Array.from(
      {
        length:
          stageCount()
      },
      (_,index)=>
        index+1
    );
  }


  function normalizeStageList(value){

    if(!Array.isArray(value)){
      return [];
    }


    const count=
      stageCount();


    return[
      ...new Set(
        value
          .map(
            stage=>
              Math.floor(
                Number(stage)||0
              )
          )
          .filter(
            stage=>
              stage>=1 &&
              stage<=count
          )
      )
    ].sort(
      (a,b)=>a-b
    );
  }


  function normalizeRewards(value){

    if(
      !value ||
      typeof value!=="object" ||
      Array.isArray(value)
    ){
      return{};
    }


    const count=
      stageCount();

    const result={};


    for(
      const [
        rawStage,
        rawReward
      ]
      of Object.entries(value)
    ){

      const stage=
        Math.floor(
          Number(rawStage)||0
        );


      if(
        stage<1 ||
        stage>count
      ){
        continue;
      }


      result[String(stage)]=
        Math.max(
          0,
          Math.floor(
            Number(rawReward)||0
          )
        );
    }


    return result;
  }


  function isAllCompleted(
    completedStages
  ){

    const completed=
      new Set(
        completedStages
      );


    return allStages()
      .every(
        stage=>
          completed.has(stage)
      );
  }


  function freshData(){

    return{
      mainlineLevel:1,
      points:0,

      daily:{
        date:
          todayKey(),

        completed:false,

        completedStages:[],

        stageRewards:{}
      },

      soundEnabled:true
    };
  }


  class ProgressStore{

    constructor(){

      this.data=
        this.load();

      this.refreshDaily();

      this.syncDailyCompletion();
    }


    normalize(raw){

      const fresh=
        freshData();


      if(
        !raw ||
        typeof raw!=="object"
      ){
        return fresh;
      }


      const level=
        Math.max(
          1,
          Math.floor(
            Number(
              raw.mainlineLevel
            )||1
          )
        );


      const points=
        Math.max(
          0,
          Math.floor(
            Number(
              raw.points
            )||0
          )
        );


      let daily=
        fresh.daily;


      if(
        raw.daily &&
        typeof raw.daily==="object"
      ){

        let completedStages=
          normalizeStageList(
            raw.daily.completedStages
          );


        /*
          兼容之前只有：
            daily.completed = true

          的旧存档。

          旧版 completed=true 表示当天所有每日阶段都已经结算过，
          因此迁移成“当前所有阶段均已完成”，避免升级后重复领奖。
        */
        if(
          !completedStages.length &&
          raw.daily.completed===true
        ){
          completedStages=
            allStages();
        }


        const stageRewards=
          normalizeRewards(
            raw.daily.stageRewards
          );


        daily={
          date:
            String(
              raw.daily.date||
              todayKey()
            ),

          completed:
            isAllCompleted(
              completedStages
            ),

          completedStages,

          stageRewards
        };
      }


      const soundEnabled=
        typeof raw.soundEnabled==="boolean"
          ?raw.soundEnabled
          :true;


      return{
        mainlineLevel:level,
        points,
        daily,
        soundEnabled
      };
    }


    load(){

      try{

        const raw=
          JSON.parse(
            localStorage.getItem(
              KEY
            )
          );


        return this.normalize(
          raw
        );
      }
      catch{

        return freshData();
      }
    }


    save(){

      this.syncDailyCompletion(
        false
      );


      const payload={
        mainlineLevel:
          this.data.mainlineLevel,

        points:
          this.data.points,

        daily:{
          date:
            this.data.daily.date,

          completed:
            this.data.daily.completed,

          completedStages:[
            ...this.data.daily
              .completedStages
          ],

          stageRewards:{
            ...this.data.daily
              .stageRewards
          }
        },

        soundEnabled:
          this.data.soundEnabled
      };


      localStorage.setItem(
        KEY,
        JSON.stringify(
          payload
        )
      );
    }


    refreshDaily(){

      const today=
        todayKey();


      if(
        this.data.daily.date!==
        today
      ){

        this.data.daily={
          date:today,
          completed:false,
          completedStages:[],
          stageRewards:{}
        };


        this.save();

        return true;
      }


      /*
        如果开发者后来从 4 关扩展到 5 关，
        原来的 [1,2,3,4] 不应该继续被判定为“全部完成”。

        normalize + sync 会自动按当前 STAGE_COUNT 重新判断。
      */
      this.data.daily.completedStages=
        normalizeStageList(
          this.data.daily
            .completedStages
        );


      this.data.daily.stageRewards=
        normalizeRewards(
          this.data.daily
            .stageRewards
        );


      this.syncDailyCompletion(
        false
      );


      return false;
    }


    syncDailyCompletion(
      save=false
    ){

      const next=
        isAllCompleted(
          this.data.daily
            .completedStages
        );


      const changed=
        next!==
        this.data.daily.completed;


      this.data.daily.completed=
        next;


      if(
        save &&
        changed
      ){
        this.save();
      }


      return next;
    }


    get soundEnabled(){

      return(
        this.data.soundEnabled
      );
    }


    setSoundEnabled(enabled){

      this.data.soundEnabled=
        !!enabled;

      this.save();

      return(
        this.data.soundEnabled
      );
    }


    toggleSound(){

      return this.setSoundEnabled(
        !this.data.soundEnabled
      );
    }


    get mainlineLevel(){

      return(
        this.data.mainlineLevel
      );
    }


    get points(){

      return(
        this.data.points
      );
    }


    get dailyCompleted(){

      this.refreshDaily();

      return(
        this.data.daily.completed
      );
    }


    get dailyCompletedStages(){

      this.refreshDaily();

      return[
        ...this.data.daily
          .completedStages
      ];
    }


    get dailyCompletedCount(){

      return(
        this.dailyCompletedStages
          .length
      );
    }


    isDailyStageCompleted(stage){

      this.refreshDaily();


      const safeStage=
        Math.floor(
          Number(stage)||0
        );


      return this.data.daily
        .completedStages
        .includes(
          safeStage
        );
    }


    dailyStageReward(stage){

      this.refreshDaily();


      const safeStage=
        Math.floor(
          Number(stage)||0
        );


      const value=
        this.data.daily
          .stageRewards[
            String(
              safeStage
            )
          ];


      return(
        value==null
          ?null
          :Math.max(
              0,
              Math.floor(
                Number(value)||0
              )
            )
      );
    }


    /*
      每日阶段严格按顺序解锁：

      初始：
        1 可玩
        2/3/4 锁定

      完成 1：
        1 可重玩
        2 可玩
        3/4 锁定

      完成 1/2：
        1/2 可重玩
        3 可玩
        4 锁定

      全部完成：
        所有关卡都可自由切换重玩。
    */
    get nextDailyStage(){

      this.refreshDaily();


      for(
        let stage=1;
        stage<=stageCount();
        stage++
      ){

        if(
          !this.isDailyStageCompleted(
            stage
          )
        ){
          return stage;
        }
      }


      /*
        全部完成后进入每日挑战时默认回到第 1 关，
        上方关卡切换条可以自由选择其它已完成关。
      */
      return 1;
    }


    isDailyStageUnlocked(stage){

      this.refreshDaily();


      const safeStage=
        Math.floor(
          Number(stage)||0
        );


      if(
        safeStage<1 ||
        safeStage>stageCount()
      ){
        return false;
      }


      if(
        this.isDailyStageCompleted(
          safeStage
        )
      ){
        return true;
      }


      /*
        当前第一个未完成关就是“下一关”，允许进入。
        后面的继续锁定。
      */
      return(
        safeStage===
        this.nextDailyStage
      );
    }


    advanceMainline(
      completedLevel
    ){

      const next=
        Math.max(
          this.data.mainlineLevel,
          Math.floor(
            completedLevel
          )+1
        );


      if(
        next!==
        this.data.mainlineLevel
      ){

        this.data.mainlineLevel=
          next;

        this.save();
      }


      return(
        this.data.mainlineLevel
      );
    }


    addPoints(amount){

      const value=
        Math.max(
          0,
          Math.floor(
            Number(amount)||0
          )
        );


      this.data.points+=
        value;


      this.save();


      return(
        this.data.points
      );
    }


    spendPoints(amount){

      const cost=
        Math.max(
          0,
          Math.floor(
            Number(amount)||0
          )
        );


      if(
        this.data.points<
        cost
      ){
        return false;
      }


      this.data.points-=
        cost;

      this.save();

      return true;
    }


    /*
      ============================================================
      每日单关结算
      ============================================================

      每一关：
      - 第一次通关：立即加积分、记录 completedStages
      - 当天重玩：不重复加积分
      - 完成后自动解锁下一关
      - 最后一关完成时 daily.completed 自动变 true
    */
    completeDailyStage(
      stage,
      reward
    ){

      this.refreshDaily();


      const safeStage=
        Math.max(
          1,
          Math.min(
            stageCount(),
            Math.floor(
              Number(stage)||1
            )
          )
        );


      if(
        !this.isDailyStageUnlocked(
          safeStage
        ) &&
        !this.isDailyStageCompleted(
          safeStage
        )
      ){

        return{
          rewarded:false,
          locked:true,
          reward:0,
          points:
            this.data.points,
          completed:
            this.data.daily.completed
        };
      }


      if(
        this.isDailyStageCompleted(
          safeStage
        )
      ){

        return{
          rewarded:false,
          locked:false,
          reward:
            this.dailyStageReward(
              safeStage
            )||0,
          points:
            this.data.points,
          completed:
            this.data.daily.completed
        };
      }


      const value=
        Math.max(
          0,
          Math.floor(
            Number(reward)||0
          )
        );


      this.data.daily
        .completedStages
        .push(
          safeStage
        );


      this.data.daily.completedStages=
        normalizeStageList(
          this.data.daily
            .completedStages
        );


      this.data.daily.stageRewards[
        String(
          safeStage
        )
      ]=
        value;


      this.data.points+=
        value;


      this.syncDailyCompletion(
        false
      );


      this.save();


      return{
        rewarded:true,
        locked:false,
        reward:value,
        points:
          this.data.points,
        completed:
          this.data.daily.completed
      };
    }


    /*
      保留旧 API，避免其它旧代码调用时报错。
      新版 GameController 不再使用 completeDaily()。
    */
    completeDaily(reward){

      this.refreshDaily();


      if(
        this.dailyCompleted
      ){
        return{
          rewarded:false,
          points:
            this.data.points
        };
      }


      const value=
        Math.max(
          0,
          Math.floor(
            Number(reward)||0
          )
        );


      this.data.daily.completedStages=
        allStages();


      this.data.daily.completed=
        true;


      this.data.points+=
        value;


      this.save();


      return{
        rewarded:true,
        points:
          this.data.points
      };
    }
  }


  global.ProgressStore=
    ProgressStore;

})(window);
