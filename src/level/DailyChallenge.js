(function(global){

  /*
    ============================================================
    每日挑战 v4：数据驱动多阶段
    ============================================================

    现在关卡数量不再写死。

    DAILY_STAGES 是唯一的阶段配置入口：
      Stage 1 -> 12 色，精确最少 42~44
      Stage 2 -> 17 色，精确最少 60
      Stage 3 -> 23 色，精确最少 80
      Stage 4 -> 29 色，精确最少 100

    STAGE_COUNT = DAILY_STAGES.length。

    以后增加第 5 / 6 关，只需要：
      1. 增加对应 POOL；
      2. 在 DAILY_STAGES 末尾追加一项。

    GameController 不再依赖 /3、3/3、三关等硬编码。
  */


  const DAILY_GENERATOR_VERSION=10;


  const STAGE1_POOL=Object.freeze([
    {seed:319,minMoves:44,nodes:4229},
      {seed:44,minMoves:43,nodes:192197},
      {seed:688,minMoves:43,nodes:168642},
      {seed:558,minMoves:43,nodes:45401},
      {seed:560,minMoves:43,nodes:35027},
      {seed:949,minMoves:43,nodes:24595},
      {seed:177,minMoves:43,nodes:14492},
      {seed:494,minMoves:43,nodes:7764},
      {seed:683,minMoves:43,nodes:1803},
      {seed:317,minMoves:42,nodes:134687},
      {seed:763,minMoves:42,nodes:107942},
      {seed:769,minMoves:42,nodes:96979},
      {seed:722,minMoves:42,nodes:89833},
      {seed:274,minMoves:42,nodes:85671},
      {seed:58,minMoves:42,nodes:81628},
      {seed:288,minMoves:42,nodes:80630},
      {seed:885,minMoves:42,nodes:68001},
      {seed:143,minMoves:42,nodes:66752},
      {seed:857,minMoves:42,nodes:62675},
      {seed:75,minMoves:42,nodes:59939},
      {seed:388,minMoves:42,nodes:57472},
      {seed:363,minMoves:42,nodes:56418},
      {seed:842,minMoves:42,nodes:55107},
      {seed:309,minMoves:42,nodes:52236},
      {seed:972,minMoves:42,nodes:49212},
      {seed:208,minMoves:42,nodes:47388},
      {seed:459,minMoves:42,nodes:46696},
      {seed:129,minMoves:42,nodes:46198},
      {seed:156,minMoves:42,nodes:45251},
      {seed:819,minMoves:42,nodes:44481},
      {seed:708,minMoves:42,nodes:44256},
      {seed:931,minMoves:42,nodes:43012}
  ]);


  const STAGE2_POOL=Object.freeze(
    [{"id":"S2-11","minMoves":60,"bottles":[[7,9,4,3],[12,10,5,6],[8,1,13,7],[13,12,0,15],[0,12,16,7],[10,13,4,8],[16,4,10,2],[2,11,3,14],[5,11,8,16],[1,14,9,15],[14,15,8,1],[2,12,5,6],[10,11,6,9],[0,3,16,14],[9,13,3,5],[6,4,7,11],[1,0,15,2],[],[]]},{"id":"S2-14","minMoves":60,"bottles":[[3,0,15,13],[9,11,7,10],[2,11,4,1],[14,8,4,2],[12,5,10,9],[16,0,6,10],[3,16,13,1],[9,6,4,16],[7,0,11,3],[2,5,7,15],[7,1,6,14],[1,3,5,9],[12,15,16,14],[0,13,8,14],[4,6,2,8],[12,11,15,10],[12,8,13,5],[],[]]},{"id":"S2-47","minMoves":60,"bottles":[[16,15,6,1],[0,16,15,5],[14,0,9,6],[13,5,2,3],[10,8,11,16],[4,15,7,1],[16,7,4,10],[2,15,1,7],[13,4,9,12],[3,7,13,6],[0,1,8,10],[3,9,12,11],[5,0,13,12],[3,8,2,4],[14,9,12,5],[14,11,2,8],[14,11,6,10],[],[]]}]
  );


  const STAGE3_POOL=Object.freeze(
    [{"id":"S3-30","minMoves":80,"bottles":[[11,3,12,8],[11,2,18,21],[22,17,4,1],[20,0,21,5],[18,13,8,3],[10,15,6,12],[18,17,7,4],[9,4,1,3],[11,15,5,16],[2,15,22,5],[14,7,11,1],[9,20,1,16],[2,10,21,0],[21,19,17,14],[14,9,19,7],[16,6,7,15],[5,12,20,0],[10,19,4,8],[20,17,0,13],[22,13,14,6],[13,10,18,19],[12,3,9,8],[6,22,2,16],[],[]]},{"id":"S3-85","minMoves":80,"bottles":[[22,20,8,14],[2,10,9,4],[11,19,13,6],[6,15,7,1],[12,9,11,0],[4,19,15,9],[21,15,17,10],[3,2,22,5],[3,21,14,8],[9,20,14,7],[7,10,13,16],[18,3,21,12],[6,2,1,17],[6,12,11,16],[17,3,22,10],[2,0,4,13],[5,0,21,8],[1,8,19,17],[22,16,4,18],[1,16,20,5],[7,14,18,5],[0,18,11,12],[15,13,20,19],[],[]]},{"id":"S3-97","minMoves":80,"bottles":[[14,5,15,7],[1,14,11,19],[9,13,0,11],[17,18,21,7],[18,16,21,7],[16,20,22,2],[17,22,15,8],[5,9,10,12],[6,19,18,3],[6,22,9,10],[18,19,2,10],[10,3,20,4],[17,8,9,4],[3,4,14,1],[12,19,4,13],[20,11,16,8],[12,6,0,14],[6,22,17,21],[5,7,3,21],[5,0,2,16],[12,2,1,8],[1,15,13,11],[13,0,15,20],[],[]]}]
  );


  /*
    第四关：29 色 + 2 空瓶。
    三个基础布局均由 difficulty-generator 的同一生成模型产生，
    并经精确 A* 验证为 100 步最短解。
  */
  const STAGE4_POOL=Object.freeze(
    [{"id":"S4-43","seed":43,"minMoves":100,"nodes":402155,"bottles":[[14,17,22,7],[7,18,16,25],[27,15,10,20],[4,10,15,23],[1,13,24,11],[3,19,6,20],[18,17,26,19],[8,6,14,16],[28,8,19,22],[21,15,20,9],[3,2,13,25],[13,11,0,25],[8,24,12,25],[26,5,27,24],[7,1,3,5],[22,20,5,26],[18,0,3,23],[7,18,8,23],[15,17,27,14],[0,11,16,6],[17,12,0,1],[2,28,23,27],[16,6,10,21],[26,12,9,2],[14,4,1,24],[4,22,12,9],[5,19,28,2],[9,11,21,10],[28,21,13,4],[],[]]},{"id":"S4-53","seed":53,"minMoves":100,"nodes":647025,"bottles":[[12,20,23,24],[2,17,13,26],[25,2,15,18],[21,15,25,11],[7,16,6,18],[0,7,9,12],[0,22,26,16],[22,28,18,13],[3,5,16,23],[22,12,24,4],[19,20,23,1],[25,1,9,23],[1,13,17,9],[2,3,20,9],[3,4,14,21],[14,19,26,16],[10,24,14,27],[0,21,3,11],[7,11,5,18],[27,17,11,6],[14,28,6,24],[27,5,4,6],[2,8,15,13],[10,8,5,27],[19,22,21,26],[20,10,8,28],[4,10,19,8],[1,28,0,25],[17,12,7,15],[],[]]},{"id":"S4-64","seed":64,"minMoves":100,"nodes":600052,"bottles":[[15,26,3,7],[7,20,11,8],[12,15,14,20],[0,25,28,19],[24,27,6,19],[1,6,8,20],[2,28,24,1],[22,19,10,15],[15,2,23,21],[9,22,11,18],[10,16,9,17],[25,17,8,16],[13,1,9,8],[25,3,27,4],[16,14,4,5],[2,4,5,18],[12,7,28,13],[21,22,23,24],[14,27,21,28],[3,7,19,17],[9,23,6,10],[12,17,24,20],[26,5,6,18],[0,13,10,26],[27,1,11,0],[13,2,4,11],[21,26,0,18],[22,25,12,5],[16,23,3,14],[],[]]}]
  );


  const DAILY_STAGES=Object.freeze([
    Object.freeze({
      stage:1,
      kind:"seeded",
      colors:12,
      pool:STAGE1_POOL,
      targetLabel:"42~44"
    }),

    Object.freeze({
      stage:2,
      kind:"fixed",
      colors:17,
      pool:STAGE2_POOL,
      targetLabel:"60"
    }),

    Object.freeze({
      stage:3,
      kind:"fixed",
      colors:23,
      pool:STAGE3_POOL,
      targetLabel:"80"
    }),

    Object.freeze({
      stage:4,
      kind:"fixed",
      colors:29,
      pool:STAGE4_POOL,
      targetLabel:"100"
    })
  ]);


  const STAGE_COUNT=
    DAILY_STAGES.length;


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


  function createCandidateRandom(
    seed,
    attempt
  ){
    const hash=
      xmur3(
        `SODA_SEQUENCE_V${DAILY_GENERATOR_VERSION}_LEVEL_DAILY_GREEDY_${seed}_ATTEMPT_${attempt}`
      );

    return mulberry32(
      hash()
    );
  }


  function createTransformRandom(
    key,
    stage
  ){
    /*
      保留上一版 transform seed 文本，
      因而原有第 1~3 关在同一天不会因为此次重构突然换盘。
      stage=4 也自然获得稳定的每日置换。
    */
    const hash=
      xmur3(
        `SODA_DAILY_3STAGE_TRANSFORM_V1_${key}_STAGE_${stage}`
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


  function localDateKey(
    date=new Date()
  ){
    const y=date.getFullYear();
    const m=String(date.getMonth()+1).padStart(2,"0");
    const d=String(date.getDate()).padStart(2,"0");

    return `${y}-${m}-${d}`;
  }


  function daySerial(key){
    const [y,m,d]=
      String(key)
        .split("-")
        .map(Number);

    return Math.floor(
      Date.UTC(y,m-1,d)/86400000
    );
  }


  function weightedPick(
    options,
    counts,
    rng
  ){
    let total=0;

    for(const color of options){
      total+=counts[color];
    }

    let value=rng()*total;

    for(const color of options){
      value-=counts[color];

      if(value<0){
        return color;
      }
    }

    return options[
      options.length-1
    ];
  }


  function createStage1Candidate(seed){
    const colorCount=12;

    for(
      let attempt=0;
      attempt<200;
      attempt++
    ){
      const rng=
        createCandidateRandom(
          seed,
          attempt
        );

      const counts=
        Array(colorCount)
          .fill(4);

      const bottles=[];
      let valid=true;


      for(
        let bottleIndex=0;
        bottleIndex<colorCount;
        bottleIndex++
      ){
        const bottle=[];


        for(
          let slot=0;
          slot<4;
          slot++
        ){
          const options=[];


          for(
            let color=0;
            color<colorCount;
            color++
          ){
            if(
              counts[color]>0 &&
              !bottle.includes(color)
            ){
              options.push(color);
            }
          }


          if(!options.length){
            valid=false;
            break;
          }


          const color=
            weightedPick(
              options,
              counts,
              rng
            );


          bottle.push(color);
          counts[color]--;
        }


        if(!valid){
          break;
        }


        bottles.push(bottle);
      }


      if(
        valid &&
        counts.every(
          value=>value===0
        )
      ){
        bottles.push([],[]);
        return bottles;
      }
    }


    throw new Error(
      `每日挑战第一关 seed=${seed} 生成失败`
    );
  }


  function shuffle(
    array,
    rng
  ){
    const result=array.slice();


    for(
      let i=result.length-1;
      i>0;
      i--
    ){
      const j=
        randomInt(
          rng,
          i+1
        );

      [
        result[i],
        result[j]
      ]=[
        result[j],
        result[i]
      ];
    }


    return result;
  }


  function transformForDate(
    bottles,
    key,
    stage,
    colorCount
  ){
    const rng=
      createTransformRandom(
        key,
        stage
      );


    const colors=
      Array.from(
        {length:colorCount},
        (_,index)=>index
      );


    const colorPermutation=
      shuffle(
        colors,
        rng
      );


    const transformed=
      bottles
        .slice(0,colorCount)
        .map(
          bottle=>
            bottle.map(
              color=>
                colorPermutation[color]
            )
        );


    const order=
      shuffle(
        colors,
        rng
      );


    const reordered=
      order.map(
        index=>
          transformed[index]
      );


    reordered.push([],[]);

    return reordered;
  }


  function getStageConfig(stage){
    const safeStage=
      Math.floor(
        Number(stage)||1
      );

    const config=
      DAILY_STAGES[
        safeStage-1
      ];


    if(!config){
      throw new Error(
        `无效每日挑战关卡：${stage}`
      );
    }


    return config;
  }


  function stageDefinition(
    key,
    stage
  ){
    const serial=
      daySerial(key);


    const stageConfig=
      getStageConfig(stage);


    const pool=
      stageConfig.pool;


    const index=
      (
        serial+
        stageConfig.stage-1
      )%
      pool.length;


    const entry=
      pool[
        (
          index+
          pool.length
        )%
        pool.length
      ];


    if(stageConfig.kind==="seeded"){
      return{
        stage:stageConfig.stage,
        colorCount:stageConfig.colors,
        minMoves:entry.minMoves,
        sourceId:`S${stageConfig.stage}-${entry.seed}`,
        hardnessNodes:entry.nodes,
        baseBottles:
          createStage1Candidate(
            entry.seed
          )
      };
    }


    return{
      stage:stageConfig.stage,
      colorCount:
        entry.colors??
        stageConfig.colors??
        entry.bottles.length-2,
      minMoves:entry.minMoves,
      sourceId:entry.id,
      hardnessNodes:entry.nodes??null,
      baseBottles:entry.bottles
    };
  }


  function generate(
    key=localDateKey(),
    stage=1
  ){
    const safeStage=
      Math.max(
        1,
        Math.min(
          STAGE_COUNT,
          Math.floor(
            Number(stage)||1
          )
        )
      );


    const def=
      stageDefinition(
        key,
        safeStage
      );


    const bottles=
      transformForDate(
        def.baseBottles,
        key,
        safeStage,
        def.colorCount
      );


    const config=
      Object.freeze({
        level:key,
        colors:def.colorCount,
        empty:2,
        tier:`每日·极难 ${safeStage}/${STAGE_COUNT}`,
        dailyStage:safeStage,
        dailyStageCount:STAGE_COUNT,
        exactMinMoves:def.minMoves
      });


    return Object.freeze({
      version:
        global.SODA_CONFIG
          .generatorVersion,

      level:key,
      dailyKey:key,

      stage:safeStage,
      stageCount:STAGE_COUNT,

      config,

      bottles:
        bottles.map(
          bottle=>[
            ...bottle
          ]
        ),

      guaranteedSolution:
        Object.freeze([]),

      minMoves:def.minMoves,
      par:def.minMoves,
      layoutScore:def.hardnessNodes||0,
      hardnessNodes:def.hardnessNodes,
      sourceId:def.sourceId
    });
  }


  /*
    ============================================================
    每关动态满分
    ============================================================

      maxScore(stage) =
        5 * 2^stage

    例如：

      第1关：  5 * 2^1 = 10
      第2关：  5 * 2^2 = 20
      第3关：  5 * 2^3 = 40
      第4关：  5 * 2^4 = 80
      第5关：  5 * 2^5 = 160

    后续新增关卡时不需要维护积分表。
  */
  function maxScoreForStage(stage){

    const safeStage=
      Math.max(
        1,
        Math.floor(
          Number(stage)||1
        )
      );


    return Math.round(
      5*
      Math.pow(
        2,
        safeStage
      )
    );
  }


  /*
    每一关独立按效率结算：

      score =
        round(
          当前关满分 *
          最少步数 /
          实际步数
        )

    实际步数小于等于最少步数时按满分处理。

    不再使用全局固定“10~100”。
    每关最低给 1 分，避免完成后出现 0 分。
  */
  function scoreStage(
    stage,
    steps,
    minMoves
  ){

    const maxScore=
      maxScoreForStage(
        stage
      );


    const actual=
      Math.max(
        1,
        Math.floor(
          Number(steps)||1
        )
      );


    const minimum=
      Math.max(
        1,
        Math.floor(
          Number(minMoves)||1
        )
      );


    const ratio=
      Math.min(
        1,
        minimum/
        actual
      );


    return Math.max(
      1,
      Math.min(
        maxScore,
        Math.round(
          maxScore*
          ratio
        )
      )
    );
  }


  /*
    兼容旧调用。

    如果旧代码仍调用：
      scoreBySteps(steps,minMoves)

    默认按第1关计算。

    新代码应该优先使用：
      scoreStage(stage,steps,minMoves)
  */
  function scoreBySteps(
    steps,
    minMoves,
    stage=1
  ){

    return scoreStage(
      stage,
      steps,
      minMoves
    );
  }


  function efficiencyPercent(
    steps,
    minMoves
  ){
    const actual=
      Math.max(
        1,
        Number(steps)||1
      );

    const minimum=
      Math.max(
        1,
        Number(minMoves)||1
      );


    return Math.max(
      0,
      Math.min(
        100,
        Math.round(
          minimum/
          actual*
          100
        )
      )
    );
  }


  function totalMinimumForDate(
    key=localDateKey()
  ){
    let total=0;


    for(
      let stage=1;
      stage<=STAGE_COUNT;
      stage++
    ){
      total+=
        generate(
          key,
          stage
        ).minMoves;
    }


    return total;
  }



  /*
    当前所有每日关卡理论总满分。

    例如 4 关：
      10 + 20 + 40 + 80 = 150
  */
  function totalMaximumScore(){

    let total=0;


    for(
      let stage=1;
      stage<=STAGE_COUNT;
      stage++
    ){

      total+=
        maxScoreForStage(
          stage
        );
    }


    return total;
  }


  global.DailyChallenge=
    Object.freeze({
      STAGE_COUNT,
      stages:
        Object.freeze(
          DAILY_STAGES.map(
            item=>
              Object.freeze({
                stage:item.stage,
                colors:item.colors,
                targetLabel:item.targetLabel
              })
          )
        ),
      localDateKey,
      generate,
      maxScoreForStage,
      scoreStage,
      scoreBySteps,
      efficiencyPercent,
      totalMaximumScore,
      totalMinimumForDate
    });

})(window);
