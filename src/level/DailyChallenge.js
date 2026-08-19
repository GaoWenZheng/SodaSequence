(function(global){

  function localDateKey(
    date=new Date()
  ){

    const y=
      date.getFullYear();

    const m=
      String(
        date.getMonth()+1
      ).padStart(
        2,
        "0"
      );

    const d=
      String(
        date.getDate()
      ).padStart(
        2,
        "0"
      );

    return `${y}-${m}-${d}`;
  }


  function dateNumber(
    key
  ){
    return Number(
      String(key)
        .replace(
          /-/g,
          ""
        )
    );
  }


  /*
    每天不是只取一个普通“极限”关卡，
    而是从 4 个固定候选中挑 layoutScore 最高的。

    同一天：
      key 固定
      candidate 固定
      最终关卡固定

    第二天：
      key 变化
      自动生成另一局。
  */
  function generate(
    key=
      localDateKey()
  ){

    const n=
      dateNumber(
        key
      );

    let best=null;

    for(
      let salt=0;
      salt<4;
      salt++
    ){

      const virtualLevel=
        900000000+
        n*10+
        salt;

      const candidate=
        global.LevelGenerator
          .generate(
            virtualLevel
          );

      if(
        !best ||
        candidate.layoutScore>
        best.layoutScore
      ){
        best=candidate;
      }
    }


    const config=
      Object.freeze({
        ...best.config,
        tier:"每日·极难",
        level:key
      });


    return Object.freeze({
      ...best,

      level:key,

      dailyKey:key,

      config
    });
  }


  /*
    每日挑战积分：
    - 参考步数以内：100
    - 超过参考步数后，每约 10% 的参考步数降一档
    - 每档 -10
    - 最低 10

    例：
    par = 72
      <=72 : 100
      73~80:  90
      81~88:  80
      ...
      最低 :  10

    使用相对 par 而不是固定绝对步数，
    避免每天关卡规模/难度变化时评分失真。
  */
  function scoreBySteps(
    steps,
    par
  ){

    const minScore=
      global.SODA_CONFIG
        .economy
        .dailyRewardMin;

    const maxScore=
      global.SODA_CONFIG
        .economy
        .dailyRewardMax;


    const safeSteps=
      Math.max(
        0,
        Math.floor(
          Number(steps)||0
        )
      );


    const safePar=
      Math.max(
        1,
        Math.floor(
          Number(par)||1
        )
      );


    if(
      safeSteps<=safePar
    ){
      return maxScore;
    }


    /*
      10% par 为一档，至少 1 步。
      Math.ceil(72*0.1)=8。
    */
    const stepBand=
      Math.max(
        1,
        Math.ceil(
          safePar*.10
        )
      );


    const extraSteps=
      safeSteps-safePar;


    const penaltyBands=
      Math.ceil(
        extraSteps/
        stepBand
      );


    return Math.max(
      minScore,
      maxScore-
      penaltyBands*10
    );
  }


  global.DailyChallenge=
    Object.freeze({
      localDateKey,
      generate,
      scoreBySteps
    });

})(window);
