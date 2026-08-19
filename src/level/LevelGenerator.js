(function(global){

  const CAPACITY=
    global.SODA_CONFIG.bottle.capacity;

  function topColor(bottle){
    return bottle[
      bottle.length-1
    ];
  }

  function topRunLength(
    bottle
  ){
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
      if(
        bottle[i]!==color
      ){
        break;
      }

      count++;
    }

    return count;
  }

  function solvedState(
    colorCount
  ){
    const state=[];

    for(
      let color=0;
      color<colorCount;
      color++
    ){
      state.push(
        Array(CAPACITY)
          .fill(color)
      );
    }

    state.push([]);
    state.push([]);

    return state;
  }

  function segmentsInBottle(
    bottle
  ){
    if(!bottle.length){
      return 0;
    }

    let count=1;

    for(
      let i=1;
      i<bottle.length;
      i++
    ){
      if(
        bottle[i]!==
        bottle[i-1]
      ){
        count++;
      }
    }

    return count;
  }

  function segmentCount(
    state,
    colorCount
  ){
    let total=0;

    for(
      let i=0;
      i<colorCount;
      i++
    ){
      total+=
        segmentsInBottle(
          state[i]
        );
    }

    return total;
  }

  function distinctCount(
    state,
    colorCount
  ){
    let total=0;

    for(
      let i=0;
      i<colorCount;
      i++
    ){
      total+=
        new Set(
          state[i]
        ).size;
    }

    return total;
  }

  function directMergeCount(
    state,
    colorCount
  ){
    let count=0;

    for(
      let a=0;
      a<colorCount;
      a++
    ){
      for(
        let b=0;
        b<colorCount;
        b++
      ){
        if(a===b){
          continue;
        }

        if(
          topColor(state[a])===
          topColor(state[b])
        ){
          count++;
        }
      }
    }

    return count;
  }

  function scoreLayout(
    state,
    colorCount
  ){
    return(
      segmentCount(
        state,
        colorCount
      )*8
      +
      distinctCount(
        state,
        colorCount
      )*5
      -
      directMergeCount(
        state,
        colorCount
      )*3
    );
  }

  function applyMacroSwap(
    state,
    a,
    b,
    k
  ){
    const chunkA=
      state[a].splice(
        state[a].length-k,
        k
      );

    const chunkB=
      state[b].splice(
        state[b].length-k,
        k
      );

    state[a].push(
      ...chunkB
    );

    state[b].push(
      ...chunkA
    );
  }

  function macroCandidates(
    state,
    colorCount,
    k
  ){
    const candidates=[];

    for(
      let a=0;
      a<colorCount;
      a++
    ){
      for(
        let b=a+1;
        b<colorCount;
        b++
      ){

        if(
          topColor(state[a])===
          topColor(state[b])
        ){
          continue;
        }

        if(
          topRunLength(state[a])<=k ||
          topRunLength(state[b])<=k
        ){
          continue;
        }

        const before=
          segmentsInBottle(state[a])+
          segmentsInBottle(state[b]);

        const cloneA=
          state[a].slice();

        const cloneB=
          state[b].slice();

        const chunkA=
          cloneA.splice(
            cloneA.length-k,
            k
          );

        const chunkB=
          cloneB.splice(
            cloneB.length-k,
            k
          );

        cloneA.push(
          ...chunkB
        );

        cloneB.push(
          ...chunkA
        );

        const after=
          segmentsInBottle(cloneA)+
          segmentsInBottle(cloneB);

        candidates.push({
          a,
          b,
          k,
          gain:after-before
        });
      }
    }

    return candidates;
  }

  function chooseCandidate(
    candidates,
    rng
  ){
    candidates.sort(
      (x,y)=>
        y.gain-x.gain
    );

    const top=
      Math.max(
        1,
        Math.ceil(
          candidates.length*.45
        )
      );

    return candidates[
      global.SodaRandom.randomInt(
        rng,
        top
      )
    ];
  }

  function distributeMacros(
    total,
    maxPerPhase
  ){
    const base=
      Math.floor(total/3);

    const remainder=
      total%3;

    return[
      Math.min(
        maxPerPhase,
        base+
        (remainder>=1?1:0)
      ),
      Math.min(
        maxPerPhase,
        base+
        (remainder>=2?1:0)
      ),
      Math.min(
        maxPerPhase,
        base
      )
    ];
  }

  function createCandidate(
    level,
    config,
    attempt
  ){
    const rng=
      global.SodaRandom.createLevelRandom(
        level,
        attempt
      );

    const state=
      solvedState(
        config.colors
      );

    const macros=[];

    const ks=[3,2,1];

    const counts=
      distributeMacros(
        config.macros,
        config.maxPerPhase
      );

    for(
      let phase=0;
      phase<3;
      phase++
    ){
      const k=
        ks[phase];

      for(
        let n=0;
        n<counts[phase];
        n++
      ){
        const candidates=
          macroCandidates(
            state,
            config.colors,
            k
          );

        if(!candidates.length){
          break;
        }

        const choice=
          chooseCandidate(
            candidates,
            rng
          );

        applyMacroSwap(
          state,
          choice.a,
          choice.b,
          k
        );

        macros.push({
          a:choice.a,
          b:choice.b,
          k
        });
      }
    }

    // 逆序宏交换一定可以用最后两个空瓶恢复。
    const e1=
      config.colors;

    const e2=
      config.colors+1;

    const guaranteedSolution=[];

    for(
      let i=macros.length-1;
      i>=0;
      i--
    ){
      const {a,b}=
        macros[i];

      guaranteedSolution.push(
        [a,e1],
        [b,e2],
        [e2,a],
        [e1,b]
      );
    }

    return{
      state,
      macros,
      guaranteedSolution,
      score:
        scoreLayout(
          state,
          config.colors
        )
    };
  }

  function validateOpening(
    state,
    colorCount
  ){
    if(
      state.length!==
      colorCount+2
    ){
      return false;
    }

    for(
      let i=0;
      i<colorCount;
      i++
    ){
      if(
        state[i].length!==
        CAPACITY
      ){
        return false;
      }
    }

    return(
      state[colorCount].length===0 &&
      state[colorCount+1].length===0
    );
  }

  function validateSolution(
    state,
    solution
  ){
    let current=
      new global.GameState(
        state
      );

    for(
      const [from,to]
      of solution
    ){
      const command=
        new global.MoveCommand(
          current,
          from,
          to
        );

      if(!command.valid){
        return false;
      }

      current=
        command.execute(
          current
        );
    }

    return global.SodaRules.isSolved(
      current
    );
  }

  function generate(level){

    const config=
      global.SodaDifficulty.get(
        level
      );

    const valid=[];

    for(
      let attempt=0;
      attempt<90;
      attempt++
    ){
      const candidate=
        createCandidate(
          level,
          config,
          attempt
        );

      if(
        candidate.macros.length<
        config.macros
      ){
        continue;
      }

      if(
        !validateOpening(
          candidate.state,
          config.colors
        )
      ){
        continue;
      }

      if(
        !validateSolution(
          candidate.state,
          candidate.guaranteedSolution
        )
      ){
        continue;
      }

      valid.push(
        candidate
      );
    }

    if(!valid.length){
      throw new Error(
        `第 ${level} 关生成失败`
      );
    }

    valid.sort(
      (a,b)=>
        a.score-b.score
    );

    const index=
      Math.min(
        valid.length-1,
        Math.max(
          0,
          Math.floor(
            (valid.length-1)*
            config.hardnessPercentile
          )
        )
      );

    const chosen=
      valid[index];

    return Object.freeze({
      version:
        global.SODA_CONFIG.generatorVersion,

      level,

      config,

      bottles:
        chosen.state.map(
          bottle=>[...bottle]
        ),

      guaranteedSolution:
        chosen.guaranteedSolution.map(
          move=>[...move]
        ),

      par:
        chosen.guaranteedSolution.length,

      layoutScore:
        chosen.score
    });
  }

  global.LevelGenerator=
    Object.freeze({
      generate
    });

})(window);
