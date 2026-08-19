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


  global.DailyChallenge=
    Object.freeze({
      localDateKey,
      generate
    });

})(window);
