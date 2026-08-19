(function(global){

  class PourAnimator {

    constructor({
      board
    }) {

      this.board =
        board;

      this.effectLayer =
        board.effectLayer;

      this.activeCount =
        0;
    }


    /* =========================================================
       基础
       ========================================================= */

    clamp(v, min, max) {
      return Math.max(
        min,
        Math.min(
          max,
          v
        )
      );
    }

    clamp01(v) {
      return this.clamp(
        v,
        0,
        1
      );
    }

    lerp(a, b, t) {
      return a + (b - a) * t;
    }

    easeOutCubic(t) {
      return 1 -
        Math.pow(
          1 - t,
          3
        );
    }

    easeOutQuint(t) {
      return 1 -
        Math.pow(
          1 - t,
          5
        );
    }

    easeInOutCubic(t) {

      return t < 0.5
        ? 4 * t * t * t
        : 1 -
          Math.pow(
            -2 * t + 2,
            3
          ) / 2;
    }

    tween(
      duration,
      update,
      easing =
        this.easeInOutCubic
          .bind(this)
    ) {

      return new Promise(
        resolve => {

          const start =
            performance.now();

          const frame =
            now => {

              const raw =
                Math.min(
                  1,
                  (
                    now -
                    start
                  ) /
                  duration
                );

              update(
                easing(raw),
                raw
              );

              if (raw < 1) {

                requestAnimationFrame(
                  frame
                );
              }
              else {

                resolve();
              }
            };

          requestAnimationFrame(
            frame
          );
        }
      );
    }


    wait(ms) {

      return new Promise(
        resolve =>
          setTimeout(
            resolve,
            ms
          )
      );
    }


    /*
      累计倒出量。

      derivative = sin(pi*t)

      所以：
      - 开头流量从 0 增大
      - 中段最大
      - 结尾自然回到 0
    */
    pouredProgress(t) {

      return (
        0.5 -
        0.5 *
        Math.cos(
          Math.PI *
          this.clamp01(t)
        )
      );
    }


    /*
      瞬时流量。

      使用 0~1~0。
    */
    flowStrength(t) {

      return Math.pow(
        Math.max(
          0,
          Math.sin(
            Math.PI *
            this.clamp01(t)
          )
        ),
        0.42
      );
    }


    /* =========================================================
       把真正外瓶唇固定在目标瓶上方。

       以前固定的是：
         bottle.root / mouth center

       现在固定的是：
         FluidBody 计算出的 downstream outer lip

       所以瓶子继续倾斜时，
       水真正流出的那个瓶唇基本不会乱跑。
       ========================================================= */

    pinOuterLip(
      source,
      direction,
      desiredGlobal
    ) {

      const actual =
        source.getOuterLipGlobal(
          direction
        );

      source.root.x +=
        desiredGlobal.x -
        actual.x;

      source.root.y +=
        desiredGlobal.y -
        actual.y;
    }



    /*
      v3：
      不在每一帧调用 solveSpillAngle()。

      开始倒水前只采样 7 个体积点，
      动画中直接插值。
    */
    buildSpillSamples(
      source,
      initialFill,
      amount,
      direction
    ) {

      const samples = [];

      const count = 6;

      for (
        let i = 0;
        i <= count;
        i++
      ) {

        const progress =
          i / count;

        const remaining =
          Math.max(
            0.02,
            initialFill -
            amount *
            progress
          );

        samples.push({
          progress,

          angle:
            source.getSpillAngle(
              remaining,
              direction
            )
        });
      }

      return samples;
    }


    interpolateSpillAngle(
      samples,
      progress
    ) {

      const p =
        this.clamp01(
          progress
        );

      if (
        p <=
        samples[0].progress
      ) {
        return samples[0].angle;
      }

      const last =
        samples[
          samples.length - 1
        ];

      if (
        p >=
        last.progress
      ) {
        return last.angle;
      }

      for (
        let i = 0;
        i <
        samples.length - 1;
        i++
      ) {

        const a =
          samples[i];

        const b =
          samples[i + 1];

        if (
          p >= a.progress &&
          p <= b.progress
        ) {

          const local =
            (
              p -
              a.progress
            ) /
            (
              b.progress -
              a.progress
            );

          /*
            smoothstep 避免采样段之间出现速度拐点。
          */
          const smooth =
            local *
            local *
            (
              3 -
              2 * local
            );

          return this.lerp(
            a.angle,
            b.angle,
            smooth
          );
        }
      }

      return last.angle;
    }


    /* =========================================================
       正式倒水
       ========================================================= */


    async play({
      sourceIndex,
      targetIndex,
      flowId,
      color,
      amount,
      onTargetProgress=null,
      onCommit
    }) {

      const source =
        this.board.actor(
          sourceIndex
        );

      const target =
        this.board.actor(
          targetIndex
        );


      if (
        !source ||
        !target
      ) {
        return false;
      }


      this.activeCount++;


      const originalX =
        source.root.x;

      const originalY =
        source.root.y;


      const direction =
        target.root.x >=
        source.root.x
          ? 1
          : -1;


      const initialFill =
        source.state.length;


      const startSpillAngle =
        source.getSpillAngle(
          initialFill,
          direction
        );


      /*
        提前求少量关键角度。
        flow 阶段不再每帧做高成本二分。
      */
      const spillSamples =
        this.buildSpillSamples(
          source,
          initialFill,
          amount,
          direction
        );


      const targetMouth =
        target.getMouthGlobal();


      /*
        外瓶唇的目标位置。

        这次不再：
          先把 root 移到粗略位置
          → 倾斜
          → 再突然补一次 pin

        而是整个 approach 阶段就连续把“真实外瓶唇”
        移到这个点。
      */

      const desiredSpillPoint = {

        x:
          targetMouth.x -
          direction * 26,

        /*
          v3：
          原来是 -28，整个流水和源瓶唇看起来偏高。
          现在降到目标瓶口上方 18px。
        */
        y:
          targetMouth.y - 18
      };


      this.board.beginAnimation(
        source
      );


      try {

        /*
          =====================================================
          Phase 1
          一条连续的 approach 轨迹

          取消旧版单独的：
              lift 30px
          所以不会再先突然往上顿一下。

          同时：
          - root 平滑靠近目标
          - angle 从 0 平滑到 spill angle
          - 外瓶唇的位置从原始 lip 平滑移动到目标 spill point

          整个阶段是一条连续运动。
          =====================================================
        */


        const startLip =
          source.getOuterLipGlobal(
            direction
          );


        await this.tween(
          430,

          (e, raw) => {

            /*
              角度连续变化。
            */

            const angleProgress =
              this.easeOutCubic(
                this.clamp01(
                  (
                    raw -
                    0.22
                  ) /
                  0.78
                )
              );


            source.setAngle(
              startSpillAngle *
              angleProgress
            );


            /*
              想要的 lip 世界位置也连续移动。

              加一个非常轻的圆弧，
              但不再单独“垂直抬升”。
            */

            const desiredLip = {

              x:
                this.lerp(
                  startLip.x,
                  desiredSpillPoint.x,
                  e
                ),

              y:
                this.lerp(
                  startLip.y,
                  desiredSpillPoint.y,
                  e
                )
                -
                Math.sin(
                  raw *
                  Math.PI
                ) * 7
            };


            /*
              直接固定真实外瓶唇，
              而不是固定 root。
            */

            this.pinOuterLip(
              source,
              direction,
              desiredLip
            );
          },

          this.easeInOutCubic
            .bind(this)
        );


        source.setAngle(
          startSpillAngle
        );


        this.pinOuterLip(
          source,
          direction,
          desiredSpillPoint
        );


        /*
          =====================================================
          Phase 2
          真正连续倒水

          水路：
          internal surface
            → real contact
            → neck
            → outer lip
            → external jet
            → target mouth
            → target neck
            → target surface
          =====================================================
        */


        const duration =
          540 +
          amount * 120;


        await this.tween(
          duration,

          (ignored, raw) => {

            const progress =
              this.pouredProgress(
                raw
              );


            const strength =
              this.flowStrength(
                raw
              );


            /*
              v3：
              spill angle 直接由预采样曲线插值，
              不再每帧二分求解。
            */

            let angle =
              this.interpolateSpillAngle(
                spillSamples,
                progress
              );


            angle +=
              direction *
              strength *
              0.10 *
              Math.PI /
              180;


            /*
              angle + source volume 一次更新，
              源瓶每帧只重绘一次。
            */

            source.previewSourceAtAngle(
              amount,
              color,
              progress,
              angle
            );


            /*
              目标瓶可能同时接收多条流水。

              如果 Controller 提供聚合回调，
              就不能让当前动画单独 previewTarget()，
              否则多个动画会互相覆盖液面。
            */

            if (
              typeof onTargetProgress===
              "function"
            ) {
              onTargetProgress(
                progress
              );
            }
            else {
              target.previewTarget(
                amount,
                color,
                progress
              );
            }


            /*
              每一帧把真实外瓶唇固定在同一个 spill point。
              所以瓶口不会上下抽动。
            */

            this.pinOuterLip(
              source,
              direction,
              desiredSpillPoint
            );


            const breakup =
              raw > 0.94
                ? (
                    raw -
                    0.94
                  ) /
                  0.06
                : 0;


            source.updatePourFlow({
              effectLayer:
                this.effectLayer,

              target,

              flowId,

              direction,

              color,

              strength,

              breakup:
                this.clamp01(
                  breakup
                ),

              timeMs:
                performance.now()
            });
          },

          t => t
        );


        source.clearPourFlow(
          target,
          flowId
        );


        /*
          视觉完整倒完以后，
          才提交真正 GameState。
        */

        onCommit();


        source.restoreStateVisual();
        target.restoreStateVisual();


        await this.wait(
          55
        );


        /*
          =====================================================
          Phase 3
          连续返回

          不再：
              先完全扶正
              → 再平移
              → 再下落

          而是用一条连续 return trajectory。

          这样整个动作不会有第二次顿挫。
          =====================================================
        */


        const returnStartLip =
          source.getOuterLipGlobal(
            direction
          );

        const returnStartAngle =
          source.angle;


        /*
          原位 upright 时，
          外瓶唇的世界坐标。
        */

        const originalLipX =
          originalX +
          15 *
          direction *
          source.root.scale.x;

        const originalLipY =
          originalY;


        await this.tween(
          390,

          (e, raw) => {

            /*
              angle 更早回正，
              位置则稍慢一点回去。
            */

            const angleE =
              this.easeOutQuint(
                this.clamp01(
                  raw /
                  0.82
                )
              );


            source.setAngle(
              returnStartAngle *
              (
                1 -
                angleE
              )
            );


            const desiredLip = {

              x:
                this.lerp(
                  returnStartLip.x,
                  originalLipX,
                  e
                ),

              y:
                this.lerp(
                  returnStartLip.y,
                  originalLipY,
                  e
                )
                -
                Math.sin(
                  raw *
                  Math.PI
                ) * 5
            };


            this.pinOuterLip(
              source,
              direction,
              desiredLip
            );
          },

          this.easeInOutCubic
            .bind(this)
        );


        source.root.x =
          originalX;

        source.root.y =
          originalY;

        source.setAngle(0);


        return true;
      }


      finally {

        source.clearPourFlow(
          target,
          flowId
        );

        source.root.x =
          originalX;

        source.root.y =
          originalY;

        source.setAngle(0);

        source.restoreStateVisual();

        target.setAngle(0);

        target.restoreStateVisual();

        this.board.endAnimation(
          source
        );

        this.activeCount =
          Math.max(
            0,
            this.activeCount-1
          );
      }
    }

  }


  global.PourAnimator =
    PourAnimator;

})(window);
