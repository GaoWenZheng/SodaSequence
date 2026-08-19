(function(global){

  function xmur3(str){
    let h=1779033703^str.length;

    for(let i=0;i<str.length;i++){
      h=Math.imul(
        h^str.charCodeAt(i),
        3432918353
      );

      h=h<<13|h>>>19;
    }

    return function(){
      h=Math.imul(
        h^(h>>>16),
        2246822507
      );

      h=Math.imul(
        h^(h>>>13),
        3266489909
      );

      return(
        h^=h>>>16
      )>>>0;
    };
  }

  function mulberry32(seed){
    return function(){
      let t=
        seed+=0x6D2B79F5;

      t=Math.imul(
        t^t>>>15,
        t|1
      );

      t^=
        t+
        Math.imul(
          t^t>>>7,
          t|61
        );

      return(
        (t^t>>>14)>>>0
      )/4294967296;
    };
  }

  function createLevelRandom(
    level,
    attempt=0
  ){
    const version=
      global.SODA_CONFIG.generatorVersion;

    const hash=
      xmur3(
        `SODA_SEQUENCE_V${version}_LEVEL_${level}_ATTEMPT_${attempt}`
      );

    return mulberry32(
      hash()
    );
  }

  function randomInt(
    rng,
    max
  ){
    return Math.floor(
      rng()*max
    );
  }

  global.SodaRandom=
    Object.freeze({
      createLevelRandom,
      randomInt
    });

})(window);
