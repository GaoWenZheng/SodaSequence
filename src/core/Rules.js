(function(global){

  const CAPACITY =
    global.SODA_CONFIG.bottle.capacity;

  const REASON = Object.freeze({
    OK:"ok",
    SAME_BOTTLE:"same-bottle",
    SOURCE_EMPTY:"source-empty",
    TARGET_FULL:"target-full",
    COLOR_MISMATCH:"color-mismatch",
    INVALID_INDEX:"invalid-index"
  });

  function validIndex(
    state,
    index
  ){
    return(
      Number.isInteger(index) &&
      index>=0 &&
      index<state.bottleCount
    );
  }

  function topColor(bottle){
    return bottle.length
      ? bottle[bottle.length-1]
      : null;
  }

  function topRunLength(bottle){

    if(!bottle.length){
      return 0;
    }

    const color=
      topColor(bottle);

    let count=0;

    for(
      let i=bottle.length-1;
      i>=0;
      i--
    ){
      if(bottle[i]!==color){
        break;
      }

      count++;
    }

    return count;
  }

  function freeSpace(bottle){
    return CAPACITY-bottle.length;
  }

  function inspectMove(
    state,
    from,
    to
  ){

    if(
      !(state instanceof global.GameState)
    ){
      throw new TypeError(
        "Rules.inspectMove: state 必须是 GameState"
      );
    }

    if(
      !validIndex(state,from) ||
      !validIndex(state,to)
    ){
      return Object.freeze({
        valid:false,
        reason:REASON.INVALID_INDEX,
        from,
        to,
        amount:0,
        color:null
      });
    }

    if(from===to){
      return Object.freeze({
        valid:false,
        reason:REASON.SAME_BOTTLE,
        from,
        to,
        amount:0,
        color:null
      });
    }

    const source=
      state.bottle(from);

    const target=
      state.bottle(to);

    if(!source.length){
      return Object.freeze({
        valid:false,
        reason:REASON.SOURCE_EMPTY,
        from,
        to,
        amount:0,
        color:null
      });
    }

    if(target.length>=CAPACITY){
      return Object.freeze({
        valid:false,
        reason:REASON.TARGET_FULL,
        from,
        to,
        amount:0,
        color:null
      });
    }

    const color=
      topColor(source);

    if(
      target.length &&
      topColor(target)!==color
    ){
      return Object.freeze({
        valid:false,
        reason:REASON.COLOR_MISMATCH,
        from,
        to,
        amount:0,
        color
      });
    }

    const amount=
      Math.min(
        topRunLength(source),
        freeSpace(target)
      );

    return Object.freeze({
      valid:true,
      reason:REASON.OK,
      from,
      to,
      color,
      amount
    });
  }

  function applyPlan(
    state,
    plan
  ){

    if(!plan.valid){
      throw new Error(
        "Rules.applyPlan: 不能执行非法移动"
      );
    }

    const bottles=
      state.toArray();

    const source=
      bottles[plan.from];

    const target=
      bottles[plan.to];

    for(
      let i=0;
      i<plan.amount;
      i++
    ){
      target.push(
        source.pop()
      );
    }

    return new global.GameState(
      bottles
    );
  }

  function isBottleComplete(
    bottle
  ){
    return(
      bottle.length===CAPACITY &&
      bottle.every(
        color=>color===bottle[0]
      )
    );
  }

  function isSolved(state){

    return state.bottles.every(
      bottle=>
        bottle.length===0 ||
        isBottleComplete(bottle)
    );
  }

  function legalMoves(state){

    const moves=[];

    for(
      let from=0;
      from<state.bottleCount;
      from++
    ){
      for(
        let to=0;
        to<state.bottleCount;
        to++
      ){

        const plan=
          inspectMove(
            state,
            from,
            to
          );

        if(plan.valid){
          moves.push(plan);
        }
      }
    }

    return moves;
  }

  global.SodaRules=
    Object.freeze({
      CAPACITY,
      REASON,
      topColor,
      topRunLength,
      freeSpace,
      inspectMove,
      applyPlan,
      isBottleComplete,
      isSolved,
      legalMoves
    });

})(window);
