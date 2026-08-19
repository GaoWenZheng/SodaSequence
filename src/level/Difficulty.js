(function(global){

  function get(level){

    level=
      Math.max(
        1,
        Math.floor(level)
      );

    let colors;
    let macros;
    let tier;

    // 前期直接提高起点，不再出现 3 色教学局。
    if(level<=4){
      colors=5;
      macros=[5,5,6,6][level-1];
      tier="入门";
    }
    else if(level<=9){
      colors=6;
      macros=[7,7,8,8,9][level-5];
      tier=level===5
        ?"普通·挑战"
        :"普通";
    }
    else if(level<=14){
      colors=8;
      macros=[10,10,11,11,12][level-10];
      tier=level===10
        ?"高难"
        :"进阶";
    }
    else if(level<=19){
      colors=10;
      macros=[13,13,14,14,15][level-15];
      tier=level===15
        ?"困难·挑战"
        :"困难";
    }
    else if(level<=24){
      colors=12;
      macros=[16,16,17,17,18][level-20];
      tier=level===20
        ?"高难"
        :"专家";
    }
    else{
      colors=12;
      macros=18;

      if(level%10===0){
        tier="极限·高难";
      }
      else if(level%5===0){
        tier="极限·挑战";
      }
      else{
        tier="极限";
      }
    }

    const maxPerPhase=
      Math.floor(colors/2);

    const maxMacros=
      maxPerPhase*3;

    macros=
      Math.min(
        macros,
        maxMacros
      );

    // 后期不再无限加瓶子，而是从固定 seed 候选中偏向更难布局。
    const hardnessPercentile=
      Math.min(
        .97,
        .44+
        Math.log10(level+1)*.18
      );

    return Object.freeze({
      level,
      colors,
      empty:2,
      macros,
      maxPerPhase,
      maxMacros,
      hardnessPercentile,
      tier
    });
  }

  function stars(
    moves,
    par
  ){
    if(
      moves<=
      Math.ceil(par*1.15)
    ){
      return 3;
    }

    if(
      moves<=
      Math.ceil(par*1.55)
    ){
      return 2;
    }

    return 1;
  }

  global.SodaDifficulty=
    Object.freeze({
      get,
      stars
    });

})(window);
