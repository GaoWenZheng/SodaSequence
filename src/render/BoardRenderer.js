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

      this.resizeHandler=
        ()=>this.layout();

      window.addEventListener(
        "resize",
        this.resizeHandler
      );
    }

    ensureActorCount(count){

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

      this.layout();
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
        this.layout();
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
        cols=
          Math.min(
            this.actors.length,
            width>=360
              ?5
              :4
          );

        rows=
          Math.ceil(
            this.actors.length/
            cols
          );


        const sidePadding=16;

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
          22;


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


        scale=
          Math.max(
            .40,
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
        firstMouthY=
          Math.max(
            48,
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
