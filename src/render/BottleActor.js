(function(global){

  const CFG =
    global.SODA_CONFIG;

  const GEO =
    global.BottleGeometry;

  if (!global.FluidBody) {
    throw new Error(
      "BottleActor.js 需要先加载 src/render/FluidBody.js"
    );
  }


  class BottleActor {

    constructor(
      index,
      onTap
    ) {

      this.index = index;

      this.state = [];
      this.angle = 0;

      /*
        root 的原点永久就是瓶口中心。

        所有平移 / 旋转只动 root。
      */
      this.root =
        new PIXI.Container();

      this.root.eventMode =
        "static";

      this.root.cursor =
        "pointer";

      this.root.hitArea =
        new PIXI.Rectangle(
          -38,
          -12,
          76,
          190
        );

      this.root.on(
        "pointertap",
        () =>
          onTap?.(
            this.index
          )
      );


      /*
        BottleGeometry 仍使用 body 坐标：
        outer mouth y=-84。

        body 下移 84，
        让 bottle mouth 对齐 root(0,0)。
      */
      this.body =
        new PIXI.Container();

      this.body.y =
        -CFG.bottle.mouthY;

      this.root.addChild(
        this.body
      );


      /*
        =========================================================
        选中效果：只加强瓶底阴影

        不发光、不描边、不加箭头。
        选中时只显示更深、更宽的底部阴影。
        =========================================================
      */

      this.selectionShadow =
        new PIXI.Graphics();

      this.selectionShadow.visible =
        false;

      /*
        阴影放在瓶体最底层。
      */
      this.body.addChildAt(
        this.selectionShadow,
        0
      );


      /*
        =========================================================
        FluidBody 在这里创建。

        它会自己把以下内容挂到 body：
        - internal liquid
        - inner mask
        - source neck
        - receive neck
        - incoming flow

        所以 BottleActor 不再管理任何液体 Graphics。
        =========================================================
      */

      this.fluid =
        new global.FluidBody({
          root: this.root,
          body: this.body
        });


      /*
        玻璃永远最后添加，
        因此所有水都在玻璃下面。
      */

      this.glassFill =
        new PIXI.Graphics();

      this.glassOutline =
        new PIXI.Graphics();

      this.glassShine =
        new PIXI.Graphics();

      this.body.addChild(
        this.glassFill,
        this.glassOutline,
        this.glassShine
      );

      this.drawBottle();
      this.drawSelection();
    }


    /* =========================================================
       玻璃
       ========================================================= */

    drawBottle() {

      this.glassFill.clear();

      GEO.drawOuter(
        this.glassFill
      );

      this.glassFill.fill({
        color: 0xecf8fb,
        alpha: 0.15
      });


      this.glassOutline.clear();

      GEO.drawOuter(
        this.glassOutline
      );

      this.glassOutline.stroke({
        color: 0x526f7f,
        width: 2.7,
        alpha: 0.72
      });


      this.glassOutline
        .roundRect(
          -21,
          -91,
          42,
          10,
          5
        )
        .fill({
          color: 0xf8fdff,
          alpha: 0.15
        })
        .stroke({
          color: 0x526f7f,
          width: 2.7,
          alpha: 0.72
        });


      this.glassShine.clear();

      this.glassShine
        .moveTo(
          -20,
          -45
        )
        .bezierCurveTo(
          -23,
          -18,
          -22,
          26,
          -19,
          55
        )
        .stroke({
          color: 0xffffff,
          width: 3.1,
          alpha: 0.38
        });
    }



    /* =========================================================
       选中视觉

       1. 用 BottleGeometry 的真实外轮廓描边
       2. 瓶口上方放一个明显的小箭头
       3. 再补一个瓶口短高光

       不用滤镜/glow filter，避免手机额外 GPU 开销。
       ========================================================= */

    drawSelection() {

      const g =
        this.selectionShadow;

      g.clear();


      /*
        BottleGeometry 的瓶底大约在 body y=78 附近。

        这里用两层椭圆：
        - 外层范围更大、更淡
        - 内层更小、更深

        不使用 blur/filter，
        手机端开销很小。
      */

      g.ellipse(
        0,
        84,
        38,
        9
      );

      g.fill({
        color: 0x4d6470,
        alpha: 0.15
      });


      g.ellipse(
        0,
        84,
        29,
        6
      );

      g.fill({
        color: 0x3b5260,
        alpha: 0.22
      });
    }


    /* =========================================================
       状态

       BottleActor 只是代理到 FluidBody。
       ========================================================= */

    setState(state) {

      this.state =
        state.slice();

      this.fluid.setState(
        this.state
      );
    }


    previewSource(
      amount,
      color,
      progress
    ) {

      this.fluid.previewSource(
        amount,
        color,
        progress
      );
    }



    previewSourceAtAngle(
      amount,
      color,
      progress,
      angle
    ) {

      this.angle =
        angle;

      this.root.rotation =
        angle;

      this.fluid
        .previewSourceAtAngle(
          amount,
          color,
          progress,
          angle
        );
    }


    previewTarget(
      amount,
      color,
      progress
    ) {

      this.fluid.previewTarget(
        amount,
        color,
        progress
      );
    }


    previewTargetAggregate(
      baseState,
      color,
      incomingAmount
    ) {

      this.fluid
        .previewTargetAggregate(
          baseState,
          color,
          incomingAmount
        );
    }


    restoreStateVisual() {

      this.fluid
        .restoreStateVisual();
    }


    /* =========================================================
       Transform
       ========================================================= */

    setPosition(
      mouthX,
      mouthY
    ) {

      this.root.x =
        mouthX;

      this.root.y =
        mouthY;
    }


    setScale(scale) {

      this.root.scale.set(
        scale
      );
    }


    setSelected(active) {

      this.selectionShadow.visible =
        !!active;

      /*
        不改变瓶子的透明度、位置、缩放。
      */
      this.root.alpha = 1;
    }


    setAngle(angle) {

      this.angle =
        angle;

      this.root.rotation =
        angle;

      this.fluid.setAngle(
        angle
      );
    }


    /* =========================================================
       Fluid geometry API
       ========================================================= */

    getMouthGlobal() {

      return this.fluid
        .getOuterMouthGlobal();
    }


    getSurfaceGlobal() {

      return this.fluid
        .getSurfaceGlobal();
    }


    getOuterLipGlobal(
      direction
    ) {

      return this.fluid
        .getOuterLipGlobal(
          direction
        );
    }


    getSpillAngle(
      amount,
      direction
    ) {

      return this.fluid
        .solveSpillAngle(
          amount,
          direction
        );
    }


    updatePourFlow({
      effectLayer,
      target,
      flowId,
      direction,
      color,
      strength,
      breakup,
      timeMs
    }) {

      this.fluid
        .updatePourFlow({
          effectLayer,

          targetFluid:
            target.fluid,

          flowId,

          direction,

          colorId:
            color,

          strength,

          breakup,

          timeMs
        });
    }


    clearPourFlow(
      target,
      flowId=null
    ) {

      this.fluid
        .clearPourFlow(
          target?.fluid,
          flowId
        );
    }
  }


  global.BottleActor =
    BottleActor;

})(window);
