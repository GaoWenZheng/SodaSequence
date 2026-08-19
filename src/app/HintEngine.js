(function(global){

  function scoreMove(
    state,
    plan
  ){
    const next=
      global.SodaRules.applyPlan(
        state,
        plan
      );

    const fromBefore=
      state.bottle(
        plan.from
      );

    const toBefore=
      state.bottle(
        plan.to
      );

    const fromAfter=
      next.bottle(
        plan.from
      );

    const toAfter=
      next.bottle(
        plan.to
      );

    let score=0;

    // 合并到已有同色上优先。
    if(toBefore.length){
      score+=6;
    }

    // 完成整瓶最优先。
    if(
      global.SodaRules
        .isBottleComplete(
          toAfter
        )
    ){
      score+=14;
    }

    // 腾空一个瓶子有价值。
    if(!fromAfter.length){
      score+=4;
    }

    // 不鼓励把完整纯色瓶倒进空瓶。
    if(
      global.SodaRules
        .isBottleComplete(
          fromBefore
        ) &&
      !toBefore.length
    ){
      score-=12;
    }

    // 一次能倒更多通常更好。
    score+=
      plan.amount*.8;

    return score;
  }

  function bestMove(state){

    const moves=
      global.SodaRules
        .legalMoves(
          state
        );

    if(!moves.length){
      return null;
    }

    return moves
      .map(
        plan=>({
          plan,
          score:
            scoreMove(
              state,
              plan
            )
        })
      )
      .sort(
        (a,b)=>
          b.score-a.score
      )[0].plan;
  }

  global.HintEngine=
    Object.freeze({
      bestMove
    });

})(window);
