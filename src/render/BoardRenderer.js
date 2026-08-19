(function(global){

  class BoardRenderer{

    constructor({
      app,
      host,
      onBottleTap
    }){
      this.app=app;
      this.host=host;
      this.onBottleTap=
        onBottleTap;

      this.bottleLayer=
        new PIXI.Container();

      this.effectLayer=
        new PIXI.Container();

      this.bottleLayer.sortableChildren=
        true;

      app.stage.addChild(
        this.bottleLayer,
        this.effectLayer
      );

      this.actors=[];
      this.selected=-1;
      this.hintMove=null;
      // 可以同时有多个倒水动画。
      // 只要 activeAnimationCount > 0，就暂时不响应 resize 布局。
      this.activeAnimationCount=0;

      /*
        普通选择状态变化不应该重新计算所有瓶子坐标。

        只有：
        - 第一次布局
        - 瓶子数量变化
        - resize
        才真正 layout。
      */
      this.layoutInitialized=false;
      this.layoutDirty=true;

      this.resizeHandler=
        ()=>{
          this.layoutDirty=true;
          this.layout();
        };

      window.addEventListener(
        "resize",
        this.resizeHandler
      );


      /*
        手机端新增每日关卡切换条后，
        pixiHost 的高度会在“不改变 window 尺寸”的情况下变化。

        只监听 window.resize 不够：
        进入每日模式 / 切换 UI 区块时，
        canvas 可能继续保留旧高度。

        ResizeObserver 直接监听 host 实际尺寸，
        只有宽高真正变化才重新布局。

        普通点击瓶子不会改变 host 尺寸，
        因此不会重新引入“第一次点击瓶子整体上移”的旧问题。
      */
      this.observedHostSize={
        width:0,
        height:0
      };


      this.resizeObserver=
        typeof ResizeObserver!=="undefined"
          ?new ResizeObserver(
              entries=>{

                const entry=
                  entries[0];


                if(!entry){
                  return;
                }


                const width=
                  Math.round(
                    entry.contentRect.width
                  );


                const height=
                  Math.round(
                    entry.contentRect.height
                  );


                if(
                  Math.abs(
                    width-
                    this.observedHostSize.width
                  )<1 &&
                  Math.abs(
                    height-
                    this.observedHostSize.height
                  )<1
                ){
                  return;
                }


                this.observedHostSize={
                  width,
                  height
                };


                this.layoutDirty=true;


                if(
                  this.activeAnimationCount===0
                ){

                  requestAnimationFrame(
                    ()=>
                      this.layoutIfNeeded()
                  );
                }
              }
            )
          :null;


      this.resizeObserver
        ?.observe(
          this.host
        );
    }

    ensureActorCount(count){

      const before=
        this.actors.length;


      while(
        this.actors.length>count
      ){
        const actor=
          this.actors.pop();

        this.bottleLayer
          .removeChild(
            actor.root
          );

        actor.root.destroy({
          children:true
        });
      }


      while(
        this.actors.length<count
      ){
        const index=
          this.actors.length;

        const actor=
          new global.BottleActor(
            index,
            i=>
              this.onBottleTap?.(i)
          );

        this.actors.push(
          actor
        );

        this.bottleLayer.addChild(
          actor.root
        );
      }


      const changed=
        before!==
        this.actors.length;


      if(changed){
        this.layoutDirty=true;
      }


      return changed;
    }

    setState(
      gameState,
      selected=-1,
      hintMove=null
    ){
      this.ensureActorCount(
        gameState.bottleCount
      );

      this.selected=
        selected;

      this.hintMove=
        hintMove;

      for(
        let i=0;
        i<gameState.bottleCount;
        i++
      ){
        const actor=
          this.actors[i];

        actor.setState(
          gameState.bottle(i)
        );

        actor.setSelected(
          i===selected
        );

        actor.root.alpha=
          1;

        if(
          hintMove &&
          (
            i===hintMove[0] ||
            i===hintMove[1]
          )
        ){
          actor.root.alpha=
            .72;
        }
      }

      this.layoutIfNeeded();
    }

    syncActor(
      index,
      bottle
    ){
      this.actors[index]
        ?.setState(
          bottle
        );
    }

    actor(index){
      return this.actors[index];
    }


    beginAnimation(
      actor
    ){

      this.activeAnimationCount++;

      if(actor){
        actor.root.zIndex=
          100+
          this.activeAnimationCount;
      }
    }

    endAnimation(
      actor
    ){

      if(actor){
        actor.root.zIndex=0;
      }

      this.activeAnimationCount=
        Math.max(
          0,
          this.activeAnimationCount-1
        );

      if(
        this.activeAnimationCount===0
      ){
        this.layoutIfNeeded();
      }
    }

    bringToFront(
      actor
    ){
      if(actor){
        actor.root.zIndex=100;
      }
    }

    clearFront(
      actor=null
    ){

      if(actor){
        actor.root.zIndex=0;
        return;
      }

      for(
        const item
        of this.actors
      ){
        item.root.zIndex=0;
      }
    }




    layoutIfNeeded(){

      if(
        !this.layoutInitialized ||
        this.layoutDirty
      ){
        this.layout();
      }
    }


    layout(){

      if(
        this.activeAnimationCount>0 ||
        !this.actors.length
      ){
        return;
      }

      const CFG=
        global.SODA_CONFIG;

      const width=
        Math.max(
          280,
          this.host.clientWidth||900
        );

      const mobile=
        width<700;


      let height;

      if(mobile){

        /*
          手机端棋盘高度完全交给 CSS grid。
          Renderer 不再主动撑高页面。
        */
        height=
          Math.max(
            280,
            this.host.clientHeight||
            (
              window.innerHeight-
              150
            )
          );

        this.host.style.height=
          "100%";
      }
      else{

        const gap=
          CFG.board.desktopGap;

        const maxCols=
          Math.max(
            4,
            Math.floor(
              (width-34)/
              gap
            )
          );

        const cols=
          Math.min(
            maxCols,
            this.actors.length
          );

        const rows=
          Math.ceil(
            this.actors.length/
            cols
          );

        height=
          Math.max(
            CFG.board.minHeight,
            CFG.board.topSafeSpace+
            rows*176+
            CFG.board.bottomPadding
          );

        this.host.style.height=
          height+"px";
      }


      this.app.renderer.resize(
        width,
        height
      );


      let cols;
      let rows;
      let gap;
      let rowStep;
      let firstMouthY;
      let scale;


      if(mobile){

        /*
          390px 左右：
          一行最多 5 个。

          320px 左右：
          一行最多 4 个。
        */
        /*
          早期关卡瓶子少时保持原来的宽松布局。

          每日后期关卡：
          23 色 / 29 色会有 25~31 个瓶子。
          如果仍然一行最多 5 个，会形成 5~7 行，
          手机纵向根本放不下。

          因此根据瓶子总数自动提高列数：
            <18 瓶：5列
            18~24：6列
            >=25：7列

          320px 窄屏仍然保守一点。
        */
        let mobileMaxCols;


        if(width<340){

          mobileMaxCols=
            this.actors.length>=24
              ?6
              :4;
        }
        else if(
          this.actors.length>=25
        ){

          mobileMaxCols=7;
        }
        else if(
          this.actors.length>=18
        ){

          mobileMaxCols=6;
        }
        else{

          mobileMaxCols=
            width>=360
              ?5
              :4;
        }


        cols=
          Math.min(
            this.actors.length,
            mobileMaxCols
          );


        rows=
          Math.ceil(
            this.actors.length/
            cols
          );


        const sidePadding=
          cols>=7
            ?10
            :cols>=6
              ?12
              :16;

        gap=
          cols<=1
            ?0
            :Math.min(
                CFG.board.mobileGap,
                (
                  width-
                  sidePadding*2
                )/
                (
                  cols-1
                )
              );


        /*
          BottleActor 从瓶口到瓶底，
          未缩放时视觉高度大约 172px。

          这里不再使用：
              rowHeight = usable / rows

          因为那会把 2 行瓶子强行撑满整块棋盘。

          新逻辑：
          先决定一个正常瓶子高度，
          再决定固定的小行距，
          最后把整个网格整体垂直居中。
        */

        const nominalBottleHeight=
          172;


        /*
          横向宽度给出的 scale 上限。
        */
        const scaleByWidth=
          cols<=1
            ?CFG.board.mobileScale
            :(
                gap/
                72
              )*.88;


        /*
          高度只负责防止瓶子组放不下，
          不再负责把两行撑开。

          两行默认只留约 22px 的视觉间距。
        */
        const desiredRowGap=
          rows>=5
            ?14
            :rows>=4
              ?17
              :22;


        const maxBottleHeightByBoard=
          (
            height-
            28-
            Math.max(
              0,
              rows-1
            )*
            desiredRowGap
          )/
          Math.max(
            1,
            rows
          );


        const scaleByHeight=
          maxBottleHeightByBoard/
          nominalBottleHeight;


        /*
          关卡瓶子非常多时允许再缩小一些。
          普通主线仍保持 >= .40，
          不影响原来的视觉尺寸。
        */
        const minMobileScale=
          rows>=6
            ?.30
            :rows>=5
              ?.33
              :.40;


        scale=
          Math.max(
            minMobileScale,
            Math.min(
              CFG.board.mobileScale,
              scaleByWidth,
              scaleByHeight
            )
          );


        const bottleHeight=
          nominalBottleHeight*
          scale;


        /*
          行间距保持固定、紧凑。
          屏幕很矮时会随 scale 略缩小。
        */
        const rowGap=
          Math.max(
            12,
            desiredRowGap*
            Math.min(
              1,
              scale/
              CFG.board.mobileScale
            )
          );


        /*
          一行瓶子的 mouth 到下一行 mouth：

            当前瓶身高度 + 行间距

          这样两行永远靠在一起，
          不会被棋盘高度拉开。
        */
        rowStep=
          bottleHeight+
          rowGap;


        /*
          整个瓶子组实际高度：

            第一行 mouth
              ↓
            瓶身
            gap
            第二行 mouth
              ↓
            瓶身

          然后把整个 group 在 board 中垂直居中。
        */
        const groupHeight=
          rows*
          bottleHeight+
          Math.max(
            0,
            rows-1
          )*
          rowGap;


        firstMouthY=
          (
            height-
            groupHeight
          )/2;


        /*
          给顶部保留最小空间，
          防止极矮屏幕上倒水动画被裁掉。

          正常截图这种高度下，
          实际值仍然由“整体居中”决定。
        */
        const minTopSpace=
          rows>=6
            ?20
            :rows>=5
              ?26
              :rows>=4
                ?34
                :48;


        firstMouthY=
          Math.max(
            minTopSpace,
            firstMouthY
          );
      }
      else{

        gap=
          CFG.board.desktopGap;

        const maxCols=
          Math.max(
            4,
            Math.floor(
              (width-34)/
              gap
            )
          );

        cols=
          Math.min(
            maxCols,
            this.actors.length
          );

        rows=
          Math.ceil(
            this.actors.length/
            cols
          );

        scale=
          CFG.board.desktopScale;

        rowStep=176;

        firstMouthY=
          CFG.board.topSafeSpace;
      }


      for(
        let row=0;
        row<rows;
        row++
      ){

        const start=
          row*cols;

        const count=
          Math.min(
            cols,
            this.actors.length-start
          );

        const rowWidth=
          (count-1)*gap;

        const firstX=
          width/2-
          rowWidth/2;


        for(
          let col=0;
          col<count;
          col++
        ){

          const index=
            start+col;

          const actor=
            this.actors[index];


          actor.setScale(
            scale
          );


          actor.setAngle(0);


          actor.setPosition(
            firstX+
            col*gap,

            firstMouthY+
            row*rowStep
          );
        }
      }
      this.layoutInitialized=true;
      this.layoutDirty=false;

    }

    destroy(){

      window.removeEventListener(
        "resize",
        this.resizeHandler
      );
    }
  }

  global.BoardRenderer=
    BoardRenderer;

})(window);
