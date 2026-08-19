(function(global){

  const CFG = global.SODA_CONFIG;
  const GEO = global.BottleGeometry;

  class FluidBody {

    constructor({ root, body }) {

      this.root = root;
      this.body = body;

      this.state = [];
      this.visualSegments = [];
      this.angle = 0;

      this.currentSurfaceY = CFG.bottle.innerBottom;

      this.effectLayer = null;
      this.externalGraphics = null;
      this.externalHighlight = null;

      /*
        一个目标瓶可以同时接收多条流水。

        key   = flowId
        value = { color, strength }

        外部 jet 仍然属于各自的 source FluidBody；
        这里只聚合目标瓶内部的入流表现。
      */
      this.incomingFlows =
        new Map();

      /*
        =========================================================
        结构

        BottleActor.root      // 原点永久是瓶口中心
          └─ body
              ├─ liquidFrame      // 瓶内主体液体，世界水平
              ├─ incomingFrame    // 目标瓶内部落水，世界垂直
              ├─ innerMask        // 唯一内腔几何
              ├─ sourceNeck       // 源瓶：内液面 → 外瓶唇
              └─ receiveNeck      // 目标瓶：外瓶口 → 内腔

        外部液柱虽然挂在 Board.effectLayer，
        但创建、计算、更新、删除全部由 FluidBody 自己负责。

        PourAnimator 不再画任何水。
        =========================================================
      */

      this.liquidFrame = new PIXI.Container();
      this.incomingFrame = new PIXI.Container();

      /*
        v4：
        sourceNeck 不能直接挂 body。
        否则它会跟瓶子一起倾斜，瓶颈水的自由表面就会斜掉。

        spillFrame 和 liquidFrame 一样做 counter-rotation，
        但不受 innerMask 裁切。
        因此：
        内部液面 → 瓶颈水 → 外瓶唇
        可以保持同一条世界水平自由表面。
      */
      this.spillFrame = new PIXI.Container();

      /*
        v3 性能优化：
        内部液体和目标瓶落水各自只保留一个 Graphics。
        每帧只 clear + 重画，不再 destroy/new。
      */
      this.internalGraphics = new PIXI.Graphics();
      this.incomingGraphics = new PIXI.Graphics();

      this.liquidFrame.addChild(
        this.internalGraphics
      );

      this.incomingFrame.addChild(
        this.incomingGraphics
      );

      this.innerMask = new PIXI.Graphics();

      this.sourceNeck = new PIXI.Graphics();
      this.receiveNeck = new PIXI.Graphics();

      this.spillFrame.addChild(
        this.sourceNeck
      );

      this.body.addChild(
        this.liquidFrame,
        this.incomingFrame,
        this.innerMask,
        this.spillFrame,
        this.receiveNeck
      );

      this.liquidFrame.mask = this.innerMask;
      this.incomingFrame.mask = this.innerMask;

      this.drawMask();
    }


    /* =========================================================
       基础
       ========================================================= */

    clamp(v, min, max) {
      return Math.max(min, Math.min(max, v));
    }

    clamp01(v) {
      return this.clamp(v, 0, 1);
    }

    lerp(a, b, t) {
      return a + (b - a) * t;
    }

    stateToSegments(state = this.state) {

      const segments = [];

      for (const color of state) {

        const last = segments[segments.length - 1];

        if (last && last.color === color) {
          last.amount += 1;
        }
        else {
          segments.push({
            color,
            amount: 1
          });
        }
      }

      return segments;
    }

    cloneSegments(segments) {
      return segments.map(segment => ({
        color: segment.color,
        amount: segment.amount
      }));
    }

    totalVisualAmount() {
      return this.visualSegments.reduce(
        (sum, segment) => sum + segment.amount,
        0
      );
    }


    /* =========================================================
       Mask
       ========================================================= */

    drawMask() {

      this.innerMask.clear();

      GEO.drawInner(
        this.innerMask
      );

      this.innerMask.fill(
        0xffffff
      );
    }


    /* =========================================================
       坐标

       BottleGeometry 的 inner polygon 使用 body 坐标。

       body.y = -mouthY

       root 的 (0,0) = 真正外瓶口中心。
       ========================================================= */

    bodyOffset() {
      return {
        x: 0,
        y: -CFG.bottle.mouthY
      };
    }

    rotatePoint(point, angle) {

      const c = Math.cos(angle);
      const s = Math.sin(angle);

      return {
        x:
          point.x * c -
          point.y * s,

        y:
          point.x * s +
          point.y * c
      };
    }

    /*
      把一个 body-local 点转换成 liquidFrame 使用的
      “世界水平 body 坐标”。

      与 BottleGeometry.transformedInnerPolygon() 使用同一套数学。
    */
    transformBodyPointForFluid(point, angle = this.angle) {

      const d = this.bodyOffset();

      const relativeToMouth = {
        x: point.x + d.x,
        y: point.y + d.y
      };

      const rotated =
        this.rotatePoint(
          relativeToMouth,
          angle
        );

      return {
        x: rotated.x - d.x,
        y: rotated.y - d.y
      };
    }


    /*
      瓶内腔最上方的两个点。

      注意：
      这里不是外瓶唇。

      INNER path 到 y=-70，
      外部真实瓶口则在 root y≈0。

      因此中间还必须有一段“瓶颈水”，
      不能让外部 jet 凭空出现。
    */
    innerLipBody(direction) {

      return {
        x: 14 * direction,
        y: -70
      };
    }


    /*
      真正外瓶唇。

      root 原点就是瓶口中心，
      因此外唇就在它左右两边。

      这个点是外部液柱真正的起点。
    */
    outerLipRoot(direction) {

      return {
        x: 15 * direction,
        y: 0
      };
    }



    /*
      同一个真实外瓶唇的 body-local 坐标。

      root 中：
        (15*direction, 0)

      body 因为整体下移 -mouthY，
      所以换算到 body local：
        (15*direction, mouthY)
    */
    outerLipBody(direction) {

      return {
        x:
          15 * direction,

        y:
          CFG.bottle.mouthY
      };
    }


    getOuterLipGlobal(direction) {

      const p = this.outerLipRoot(direction);

      const globalPoint =
        this.root.toGlobal(
          new PIXI.Point(
            p.x,
            p.y
          )
        );

      return {
        x: globalPoint.x,
        y: globalPoint.y
      };
    }


    /*
      目标瓶的入口。

      外部液柱到这里结束；
      接下来由目标 FluidBody.incomingFrame 继续向液面落下。
    */
    getOuterMouthGlobal() {

      const p =
        this.root.toGlobal(
          new PIXI.Point(
            0,
            0
          )
        );

      return {
        x: p.x,
        y: p.y
      };
    }


    getSurfaceGlobal() {

      const p =
        this.liquidFrame.toGlobal(
          new PIXI.Point(
            0,
            this.currentSurfaceY
          )
        );

      return {
        x: p.x,
        y: p.y
      };
    }


    /* =========================================================
       世界水平液体坐标系

       root.rotation = +angle
       liquidFrame.rotation = -angle

       但 body 本身有 offset，
       所以还必须做位置补偿。
       ========================================================= */

    updateFluidFrameTransform() {

      const d = this.bodyOffset();

      const c = Math.cos(-this.angle);
      const s = Math.sin(-this.angle);

      const rotatedD = {
        x:
          d.x * c -
          d.y * s,

        y:
          d.x * s +
          d.y * c
      };

      for (const frame of [
        this.liquidFrame,
        this.incomingFrame,
        this.spillFrame
      ]) {

        frame.rotation =
          -this.angle;

        frame.x =
          rotatedD.x - d.x;

        frame.y =
          rotatedD.y - d.y;
      }
    }


    /* =========================================================
       游戏状态 / 连续预览
       ========================================================= */

    setState(state) {

      this.state =
        state.slice();

      this.visualSegments =
        this.stateToSegments(
          this.state
        );

      this.renderInternalLiquid();
    }


    setVisualSegments(segments) {

      this.visualSegments =
        this.cloneSegments(
          segments
        ).filter(
          segment =>
            segment.amount > 0.0001
        );

      this.renderInternalLiquid();
    }


    previewSource(
      amount,
      color,
      progress
    ) {

      const p =
        this.clamp01(progress);

      const permanentCount =
        this.state.length -
        amount;

      const lower =
        this.state.slice(
          0,
          permanentCount
        );

      const segments =
        this.stateToSegments(
          lower
        );

      const remaining =
        amount *
        (1 - p);

      if (remaining > 0.0001) {

        const last =
          segments[
            segments.length - 1
          ];

        if (
          last &&
          last.color === color
        ) {
          last.amount += remaining;
        }
        else {
          segments.push({
            color,
            amount: remaining
          });
        }
      }

      this.setVisualSegments(
        segments
      );
    }



    /*
      v3：
      flow 阶段把 angle + fractional volume 一次性提交给 FluidBody，
      从而源瓶每帧只 renderInternalLiquid() 一次。

      旧版：
        previewSource() -> render
        setAngle()      -> render

      新版：
        previewSourceAtAngle() -> render once
    */
    previewSourceAtAngle(
      amount,
      color,
      progress,
      angle
    ) {

      const p =
        this.clamp01(
          progress
        );

      const permanentCount =
        this.state.length -
        amount;

      const lower =
        this.state.slice(
          0,
          permanentCount
        );

      const segments =
        this.stateToSegments(
          lower
        );

      const remaining =
        amount *
        (1 - p);

      if (
        remaining > 0.0001
      ) {

        const last =
          segments[
            segments.length - 1
          ];

        if (
          last &&
          last.color === color
        ) {
          last.amount +=
            remaining;
        }
        else {
          segments.push({
            color,
            amount:
              remaining
          });
        }
      }

      this.angle =
        angle;

      this.updateFluidFrameTransform();

      this.visualSegments =
        segments;

      this.renderInternalLiquid();
    }


    previewTarget(
      amount,
      color,
      progress
    ) {

      const p =
        this.clamp01(progress);

      const segments =
        this.stateToSegments(
          this.state
        );

      const incoming =
        amount * p;

      if (incoming > 0.0001) {

        const last =
          segments[
            segments.length - 1
          ];

        if (
          last &&
          last.color === color
        ) {
          last.amount += incoming;
        }
        else {
          segments.push({
            color,
            amount: incoming
          });
        }
      }

      this.setVisualSegments(
        segments
      );
    }


    /*
      多个源瓶同时向一个目标瓶倒水时，
      目标液面不能由每个 PourAnimator 各画各的。

      baseState:
        第一条并发入流开始之前，目标瓶真正的整数状态。

      incomingAmount:
        所有当前并发入流：
        Σ(amount * progress)

      因为 Rules 会先在逻辑层提交每条 MoveCommand，
      所有并发入流一定受到：
      - 容量 <= 4
      - 顶部颜色一致
      的约束。
    */
    previewTargetAggregate(
      baseState,
      color,
      incomingAmount
    ) {

      const segments =
        this.stateToSegments(
          baseState
        );

      const incoming =
        Math.max(
          0,
          incomingAmount
        );

      if (
        incoming > 0.0001
      ) {

        const last =
          segments[
            segments.length - 1
          ];

        if (
          last &&
          last.color === color
        ) {
          last.amount +=
            incoming;
        }
        else {
          segments.push({
            color,
            amount:
              incoming
          });
        }
      }

      this.setVisualSegments(
        segments
      );
    }


    restoreStateVisual() {

      this.visualSegments =
        this.stateToSegments(
          this.state
        );

      this.renderInternalLiquid();
    }


    /* =========================================================
       内部液体

       每一格 = 固定面积，而不是固定像素高度。
       ========================================================= */

    /*
      v3：
      BottleGeometry 原版 solveSurfaceY 使用 42 次二分，
      对动画来说远远超过屏幕像素所需精度。

      14 次已经能把误差压到远低于 0.1px，
      但计算量约只有原来的 1/3。
    */
    solveSurfaceYFast(
      points,
      targetArea
    ) {

      const b =
        GEO.bounds(
          points
        );

      if (targetArea <= 0) {
        return b.maxY + 2;
      }

      const fullArea =
        GEO.areaBelow(
          points,
          b.minY - 8
        );

      if (targetArea >= fullArea) {
        return b.minY - 2;
      }

      let lo =
        b.minY - 4;

      let hi =
        b.maxY + 4;

      for (
        let i = 0;
        i < 14;
        i++
      ) {

        const mid =
          (lo + hi) / 2;

        const area =
          GEO.areaBelow(
            points,
            mid
          );

        if (area > targetArea) {
          lo = mid;
        }
        else {
          hi = mid;
        }
      }

      return (
        lo + hi
      ) / 2;
    }


    surfaceYForAmount(
      amount,
      angle = this.angle
    ) {

      const polygon =
        GEO.transformedInnerPolygon(
          angle
        );

      if (amount <= 0.0001) {

        const bounds =
          GEO.bounds(
            polygon
          );

        return bounds.maxY + 2;
      }

      const unitArea =
        GEO.capacityArea /
        CFG.bottle.capacity;

      return this.solveSurfaceYFast(
        polygon,
        unitArea * amount
      );
    }


    renderInternalLiquid() {

      /*
        v3：
        不再 removeChildren()/destroy()/new Graphics。

        一个 Graphics 里可以连续画不同颜色的 band，
        所以每帧只 clear 一次。
      */

      const g =
        this.internalGraphics;

      g.clear();

      const total =
        this.totalVisualAmount();

      if (total <= 0.0001) {

        this.currentSurfaceY =
          CFG.bottle.innerBottom;

        return;
      }

      const polygon =
        GEO.transformedInnerPolygon(
          this.angle
        );

      const bounds =
        GEO.bounds(
          polygon
        );

      const unitArea =
        GEO.capacityArea /
        CFG.bottle.capacity;

      const left =
        bounds.minX - 50;

      const width =
        bounds.maxX -
        bounds.minX +
        100;

      const boundaries = [
        bounds.maxY + 32
      ];

      let cumulative = 0;

      for (
        const segment
        of this.visualSegments
      ) {

        cumulative +=
          segment.amount;

        boundaries.push(
          this.solveSurfaceYFast(
            polygon,
            unitArea * cumulative
          )
        );
      }


      for (
        let i = 0;
        i < this.visualSegments.length;
        i++
      ) {

        const segment =
          this.visualSegments[i];

        const bottom =
          boundaries[i];

        const top =
          boundaries[i + 1];

        const height =
          Math.max(
            0.35,
            bottom - top
          );

        const color =
          CFG.colors[
            segment.color %
            CFG.colors.length
          ];

        g.rect(
          left,
          top,
          width,
          height + 0.8
        );

        g.fill({
          color,
          alpha: 0.95
        });
      }


      this.currentSurfaceY =
        boundaries[
          boundaries.length - 1
        ];


      const topSegment =
        this.visualSegments[
          this.visualSegments.length - 1
        ];

      const topColor =
        CFG.colors[
          topSegment.color %
          CFG.colors.length
        ];


      g.rect(
        left,
        this.currentSurfaceY - 0.85,
        width,
        2.2
      );

      g.fill({
        color: topColor,
        alpha: 1
      });


      g.rect(
        left,
        this.currentSurfaceY - 0.4,
        width,
        0.65
      );

      g.fill({
        color: 0xffffff,
        alpha: 0.18
      });
    }

    /* =========================================================
       真正关键：
       求“液面刚好碰到下游内瓶唇”的角度。

       不再使用：
       4格=54°
       3格=62°
       2格=70°
       1格=78°

       这种人为写死角度。

       而是：

       surfaceY(angle, volume)
          ==
       downstreamLipY(angle)

       所以只有水真的到达瓶口后，才允许出现外部液流。
       ========================================================= */

    spillEquation(
      angleMagnitude,
      amount,
      direction
    ) {

      const angle =
        direction *
        angleMagnitude;

      const surfaceY =
        this.surfaceYForAmount(
          amount,
          angle
        );

      /*
        v4 关键修复：

        以前这里用 innerLipBody(y=-70)，
        但外部流水实际从 outer lip(y=-84) 开始，
        天然产生约 14px 的液面/流水高度差。

        现在直接使用真正外瓶唇。
        因此求出的 angle 满足：

          current horizontal surface
                    ==
          real external spill point
      */
      const lip =
        this.transformBodyPointForFluid(
          this.outerLipBody(
            direction
          ),
          angle
        );

      return (
        surfaceY -
        lip.y
      );
    }


    solveSpillAngle(
      amount,
      direction
    ) {

      const safeAmount =
        Math.max(
          0.02,
          amount
        );

      let lo = 0;

      /*
        最后一点水需要超过 90° 才能真正到达瓶唇。
        105° 是这个瓶型比较自然的上限。
      */
      let hi =
        105 *
        Math.PI /
        180;

      const fHi =
        this.spillEquation(
          hi,
          safeAmount,
          direction
        );

      /*
        极端情况下仍到不了瓶口，
        就直接使用最大角度。
      */
      if (fHi > 0) {

        return (
          direction *
          hi
        );
      }


      for (
        let i = 0;
        i < 14;
        i++
      ) {

        const mid =
          (lo + hi) / 2;

        const f =
          this.spillEquation(
            mid,
            safeAmount,
            direction
          );

        /*
          f > 0：
          液面还在瓶唇下面，
          必须继续倾斜。
        */
        if (f > 0) {
          lo = mid;
        }
        else {
          hi = mid;
        }
      }

      return (
        direction *
        (
          (lo + hi) / 2
        )
      );
    }


    /* =========================================================
       瓶颈中的水

       这是之前缺失的一段。

       内部 liquid mask 只到 y=-70，
       外瓶口却在 root y=0（body y=-84）。

       以前：
         内部液面
           [gap]
               外部 jet

       现在：
         内部液面
           ↓
         sourceNeck
           ↓
         外瓶唇
           ↓
         external jet
       ========================================================= */


    /*
      求当前水平液面与“旋转后的瓶内腔边界”的交点。

      这是流水真正应该从哪里开始进入瓶颈的依据，
      不再把 innerLip 当成固定起点。
    */
    getSurfaceBoundaryIntersections() {

      const polygon =
        GEO.transformedInnerPolygon(
          this.angle
        );

      const y =
        this.currentSurfaceY;

      const intersections = [];

      for (
        let i = 0;
        i < polygon.length;
        i++
      ) {

        const a =
          polygon[i];

        const b =
          polygon[
            (i + 1) %
            polygon.length
          ];

        const minY =
          Math.min(
            a.y,
            b.y
          );

        const maxY =
          Math.max(
            a.y,
            b.y
          );

        if (
          y < minY - 0.0001 ||
          y > maxY + 0.0001
        ) {
          continue;
        }

        const dy =
          b.y - a.y;

        if (
          Math.abs(dy) <
          0.000001
        ) {
          continue;
        }

        const t =
          (y - a.y) /
          dy;

        if (
          t < 0 ||
          t > 1
        ) {
          continue;
        }

        intersections.push({
          x:
            a.x +
            (b.x - a.x) *
            t,

          y
        });
      }

      return intersections;
    }


    /*
      取下游侧真实接触点。

      向右倒：
        取最右侧液面/瓶壁交点。

      向左倒：
        取最左侧交点。
    */
    getDownstreamSurfaceContact(
      direction
    ) {

      const points =
        this.getSurfaceBoundaryIntersections();

      if (!points.length) {

        return this.transformBodyPointForFluid(
          this.innerLipBody(
            direction
          ),
          this.angle
        );
      }

      return points.reduce(
        (best, point) => {

          if (!best) {
            return point;
          }

          if (direction > 0) {

            return point.x >
              best.x
              ? point
              : best;
          }

          return point.x <
            best.x
            ? point
            : best;
        },
        null
      );
    }


    /*
      liquidFrame local → body local。

      旧版 sourceNeck 挂在 body 下时使用的坐标转换。
      v4 sourceNeck 已移入 spillFrame；保留该工具仅为兼容。
    */
    fluidPointToBody(
      point
    ) {

      const globalPoint =
        this.liquidFrame.toGlobal(
          new PIXI.Point(
            point.x,
            point.y
          )
        );

      const localPoint =
        this.body.toLocal(
          globalPoint
        );

      return {
        x: localPoint.x,
        y: localPoint.y
      };
    }




    drawSourceNeck(
      direction,
      color,
      strength
    ) {

      const g =
        this.sourceNeck;

      g.clear();

      const s =
        this.clamp01(
          strength
        );

      if (s <= 0.001) {
        return;
      }


      /*
        当前自由液面与下游瓶壁的真实交点。
        这是 liquidFrame/spillFrame 坐标。
      */

      const contact =
        this.getDownstreamSurfaceContact(
          direction
        );


      /*
        真正外瓶唇也转换到同一个
        “世界水平 fluid 坐标系”。

        因为 solveSpillAngle 已经使用 outer lip 求解，
        正常倒水阶段：

          outer.y ≈ currentSurfaceY
          contact.y = currentSurfaceY

        因此 top edge 是真正水平的。
      */

      const outer =
        this.transformBodyPointForFluid(
          this.outerLipBody(
            direction
          ),
          this.angle
        );


      /*
        数值误差只保留亚像素级。
        直接把两端上边界锁到同一个 currentSurfaceY，
        防止二分误差造成 0.x px 的闪动。
      */

      const topY =
        this.currentSurfaceY;


      const depth =
        2.2 +
        3.0 * s;


      /*
        contact 和 outer 谁在左/右并不重要。

        整个 bridge 都在自由液面“下面”
        （Pixi 世界 y 增大方向），
        上边缘严格等于 topY。
      */

      const innerX =
        contact.x;

      const outerX =
        outer.x;


      /*
        靠内部稍厚，
        到瓶唇略微收缩。
      */

      const innerDepth =
        depth;

      const outerDepth =
        depth * 0.72;


      g.moveTo(
        innerX,
        topY
      );

      g.lineTo(
        outerX,
        topY
      );

      g.lineTo(
        outerX,
        topY +
        outerDepth
      );

      /*
        下边界轻微弧形收缩，
        但上边界绝对不动。
      */

      g.quadraticCurveTo(
        this.lerp(
          innerX,
          outerX,
          0.52
        ),

        topY +
        depth *
        1.08,

        innerX,
        topY +
        innerDepth
      );

      g.closePath();


      g.fill({
        color,
        alpha:
          0.95 * s
      });


      /*
        让外瓶唇处稍微圆一点，
        避免 bridge → jet 看出硬矩形接缝。
      */

      g.ellipse(
        outerX,
        topY +
        outerDepth * 0.48,
        outerDepth * 0.52,
        outerDepth * 0.50
      );

      g.fill({
        color,
        alpha:
          0.95 * s
      });
    }


    drawReceiveNeck(
      color,
      strength
    ) {

      this.receiveNeck.clear();

      if (strength <= 0.001) {
        return;
      }

      const half =
        1.2 +
        1.4 *
        strength;

      this.receiveNeck
        .roundRect(
          -half,
          CFG.bottle.mouthY,
          half * 2,
          15,
          half
        )
        .fill({
          color,
          alpha:
            0.93 *
            this.clamp01(
              strength
            )
        });
    }


    /* =========================================================
       目标瓶内部落水

       外部 jet 不再一直画到液面。

       外部 jet：
         source outer lip → target outer mouth

       target incoming:
         target outer mouth → target inner neck → target surface

       这样目标瓶玻璃内部的水流会真正被瓶体 mask 裁切。
       ========================================================= */


    /*
      更新某一条目标入流。

      以前 setIncomingFlow() 每帧都会 clear，
      所以第二条水流会把第一条覆盖掉。

      现在每条流都有独立 flowId，
      最后统一 renderIncomingFlows()。
    */
    setIncomingFlow(
      flowId,
      color,
      strength
    ) {

      const id =
        flowId ??
        "default";

      const s =
        this.clamp01(
          strength
        );

      if (
        s <= 0.001
      ) {
        this.incomingFlows.delete(
          id
        );
      }
      else {
        this.incomingFlows.set(
          id,
          {
            color,
            strength:s
          }
        );
      }

      this.renderIncomingFlows();
    }


    renderIncomingFlows() {

      const g =
        this.incomingGraphics;

      g.clear();
      this.receiveNeck.clear();

      if (
        this.incomingFlows.size===0
      ) {
        return;
      }


      const flows =
        [
          ...this.incomingFlows.values()
        ];


      /*
        正常规则下所有流的颜色必然相同：
        第一条流一提交，目标瓶逻辑顶部就已经变成该颜色；
        第二条只有同色才会被 Rules 允许。
      */
      const color =
        flows[0].color;


      const totalStrength =
        flows.reduce(
          (sum,flow)=>
            sum+
            flow.strength,
          0
        );


      /*
        两条流同时进入时：
        不画两根互相覆盖的内部细线，
        而是在瓶颈内合并成稍粗的一股。

        sqrt() 避免两条流简单变成 2 倍粗。
      */
      const combined =
        this.clamp(
          Math.sqrt(
            totalStrength
          ),
          0,
          1.42
        );


      this.drawReceiveNeck(
        color,
        this.clamp01(
          combined
        )
      );


      const inlet =
        this.transformBodyPointForFluid(
          {
            x:0,
            y:-70
          },
          this.angle
        );


      const surfaceY =
        this.currentSurfaceY;


      if (
        surfaceY <=
        inlet.y+1
      ) {
        return;
      }


      const topHalf =
        1.15+
        1.15*
        combined;


      const bottomHalf =
        Math.max(
          0.85,
          topHalf*
          0.70
        );


      g.moveTo(
        inlet.x-topHalf,
        inlet.y
      );

      g.lineTo(
        inlet.x+topHalf,
        inlet.y
      );

      g.lineTo(
        inlet.x+bottomHalf,
        surfaceY
      );

      g.lineTo(
        inlet.x-bottomHalf,
        surfaceY
      );

      g.closePath();

      g.fill({
        color,
        alpha:
          0.92*
          this.clamp01(
            combined
          )
      });


      g.ellipse(
        inlet.x,
        surfaceY+0.7,
        3.2+
        1.8*
        combined,
        1.25+
        0.15*
        combined
      );

      g.fill({
        color,
        alpha:
          0.34*
          this.clamp01(
            combined
          )
      });
    }


    clearIncomingFlow(
      flowId=null
    ) {

      if (
        flowId==null
      ) {
        this.incomingFlows.clear();
      }
      else {
        this.incomingFlows.delete(
          flowId
        );
      }

      this.renderIncomingFlows();
    }


    /* =========================================================
       外部喷流
       ========================================================= */

    beginExternalFlow(
      effectLayer
    ) {

      if (
        this.effectLayer ===
        effectLayer &&
        this.externalGraphics
      ) {
        return;
      }

      this.endExternalFlow();

      this.effectLayer =
        effectLayer;

      this.externalGraphics =
        new PIXI.Graphics();

      this.externalHighlight =
        new PIXI.Graphics();

      effectLayer.addChild(
        this.externalGraphics,
        this.externalHighlight
      );
    }


    endExternalFlow() {

      this.externalGraphics
        ?.destroy();

      this.externalHighlight
        ?.destroy();

      this.externalGraphics =
        null;

      this.externalHighlight =
        null;

      this.effectLayer =
        null;

      this.sourceNeck.clear();
    }


    solveBallistic(
      start,
      end
    ) {

      /*
        外部这一段很短：

        外瓶唇
          ↓
        目标外瓶口

        所以不需要夸张曲线。
      */

      const gravity = 900;

      const dy =
        Math.max(
          5,
          end.y - start.y
        );

      const vy0 = 18;

      const discriminant =
        vy0 * vy0 +
        2 * gravity * dy;

      let time =
        (
          -vy0 +
          Math.sqrt(
            discriminant
          )
        ) /
        gravity;

      time =
        this.clamp(
          time,
          0.075,
          0.30
        );

      return {
        gravity,
        time,

        vx:
          (
            end.x -
            start.x
          ) /
          time,

        vy:
          vy0
      };
    }


    ballisticPoint(
      start,
      ballistic,
      t
    ) {

      return {
        x:
          start.x +
          ballistic.vx * t,

        y:
          start.y +
          ballistic.vy * t +
          0.5 *
          ballistic.gravity *
          t * t
      };
    }


    ballisticSpeed(
      ballistic,
      t
    ) {

      const vy =
        ballistic.vy +
        ballistic.gravity * t;

      return Math.hypot(
        ballistic.vx,
        vy
      );
    }


    /*
      连续液柱。

      体积连续性简化：
        A * v ≈ constant

      下坠越快，
      液柱越细。
    */
    drawExternalContinuousJet(
      start,
      end,
      color,
      strength
    ) {

      const g =
        this.externalGraphics;

      const h =
        this.externalHighlight;

      g.clear();
      h.clear();

      const s =
        this.clamp01(
          strength
        );

      if (s <= 0.001) {
        return;
      }

      const ballistic =
        this.solveBallistic(
          start,
          end
        );

      const count = 14;

      const left = [];
      const right = [];
      const center = [];

      const initialSpeed =
        Math.max(
          1,
          this.ballisticSpeed(
            ballistic,
            0
          )
        );

      const baseRadius =
        1.35 +
        1.75 * s;


      for (
        let i = 0;
        i <= count;
        i++
      ) {

        const u =
          i / count;

        const t =
          ballistic.time * u;

        const p =
          this.ballisticPoint(
            start,
            ballistic,
            t
          );

        center.push(p);

        const speed =
          Math.max(
            1,
            this.ballisticSpeed(
              ballistic,
              t
            )
          );

        /*
          半径 ∝ sqrt(v0/v)
        */
        const radius =
          baseRadius *
          Math.sqrt(
            initialSpeed /
            speed
          );

        const t0 =
          Math.max(
            0,
            t - 0.003
          );

        const t1 =
          Math.min(
            ballistic.time,
            t + 0.003
          );

        const a =
          this.ballisticPoint(
            start,
            ballistic,
            t0
          );

        const b =
          this.ballisticPoint(
            start,
            ballistic,
            t1
          );

        const dx =
          b.x - a.x;

        const dy =
          b.y - a.y;

        const length =
          Math.max(
            0.001,
            Math.hypot(
              dx,
              dy
            )
          );

        const nx =
          -dy / length;

        const ny =
          dx / length;

        left.push({
          x:
            p.x +
            nx * radius,

          y:
            p.y +
            ny * radius
        });

        right.push({
          x:
            p.x -
            nx * radius,

          y:
            p.y -
            ny * radius
        });
      }


      g.moveTo(
        left[0].x,
        left[0].y
      );

      for (
        let i = 1;
        i < left.length;
        i++
      ) {
        g.lineTo(
          left[i].x,
          left[i].y
        );
      }

      for (
        let i =
          right.length - 1;
        i >= 0;
        i--
      ) {
        g.lineTo(
          right[i].x,
          right[i].y
        );
      }

      g.closePath();

      g.fill({
        color,
        alpha:
          0.94 * s
      });


      /*
        非常轻的镜面高光。
        不 glow，不 blur。
      */
      h.moveTo(
        center[0].x - 0.5,
        center[0].y
      );

      for (
        let i = 1;
        i < center.length;
        i++
      ) {
        h.lineTo(
          center[i].x - 0.5,
          center[i].y
        );
      }

      h.stroke({
        color: 0xffffff,
        width: 0.6,
        alpha:
          0.13 * s
      });
    }


    /*
      尾流断裂。

      仍然从真正外瓶唇开始，
      不是随机在半空生成。
    */
    drawExternalBreakup(
      start,
      end,
      color,
      strength,
      breakup,
      timeMs
    ) {

      const g =
        this.externalGraphics;

      const h =
        this.externalHighlight;

      g.clear();
      h.clear();

      const b =
        this.solveBallistic(
          start,
          end
        );

      const phase =
        (
          timeMs * 0.0027
        ) % 1;

      const count = 3;

      for (
        let i = 0;
        i < count;
        i++
      ) {

        let u =
          phase +
          i / count;

        u =
          u -
          Math.floor(u);

        /*
          breakup 越高，
          第一滴也越远离瓶口，
          最后自然完全断开。
        */
        u =
          this.clamp01(
            u *
            (
              0.76 +
              0.24 *
              breakup
            )
          );

        const p =
          this.ballisticPoint(
            start,
            b,
            b.time * u
          );

        const radius =
          (
            1.1 +
            1.1 *
            strength
          ) *
          (
            1 -
            u * 0.24
          );

        g.ellipse(
          p.x,
          p.y,
          radius,
          radius * 1.35
        )
        .fill({
          color,
          alpha:
            0.82 *
            strength
        });
      }
    }


    /*
      一帧更新整条水：

      源瓶内部液体
        ↓
      source neck
        ↓
      外瓶唇
        ↓
      external jet
        ↓
      目标外瓶口
        ↓
      target receive neck
        ↓
      target internal incoming
        ↓
      目标液面
    */
    updatePourFlow({
      effectLayer,
      targetFluid,
      flowId,
      direction,
      colorId,
      strength,
      breakup = 0,
      timeMs = performance.now()
    }) {

      const color =
        CFG.colors[
          colorId %
          CFG.colors.length
        ];

      const s =
        this.clamp01(
          strength
        );

      this.beginExternalFlow(
        effectLayer
      );

      /*
        源瓶内部 → 外瓶唇
      */
      this.drawSourceNeck(
        direction,
        color,
        s
      );

      /*
        目标外瓶口 → 目标液面
      */
      targetFluid.setIncomingFlow(
        flowId,
        color,
        s
      );

      const start =
        this.getOuterLipGlobal(
          direction
        );

      const end =
        targetFluid
          .getOuterMouthGlobal();


      if (
        breakup > 0.001
      ) {

        this.drawExternalBreakup(
          start,
          end,
          color,
          s,
          breakup,
          timeMs
        );
      }
      else {

        this.drawExternalContinuousJet(
          start,
          end,
          color,
          s
        );
      }
    }


    clearPourFlow(
      targetFluid = null,
      flowId = null
    ) {

      this.endExternalFlow();

      targetFluid
        ?.clearIncomingFlow(
          flowId
        );
    }


    /* =========================================================
       Actor angle
       ========================================================= */

    setAngle(angle) {

      this.angle =
        angle;

      this.updateFluidFrameTransform();

      this.renderInternalLiquid();
    }
  }


  global.FluidBody =
    FluidBody;

})(window);
