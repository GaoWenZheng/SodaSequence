(function(global){

  /*
    保存记录严格只有：

    {
      mainlineLevel,
      points,
      daily:{
        date,
        completed
      },
      soundEnabled
    }

    不保存：
    - 最佳步数
    - 星级
    - 声音
    - 指定挑战
    - 当前棋盘
    - 道具使用状态

    声音开关现在允许保存：
    - soundEnabled
  */

  const KEY=
    `SODA_SEQUENCE_SAVE_V1`;


  function todayKey(){
    return global
      .DailyChallenge
      .localDateKey();
  }


  function freshData(){

    return{
      mainlineLevel:1,
      points:0,

      daily:{
        date:todayKey(),
        completed:false
      },

      soundEnabled:true
    };
  }


  class ProgressStore{

    constructor(){

      this.data=
        this.load();

      this.refreshDaily();
    }


    normalize(raw){

      const fresh=
        freshData();

      if(
        !raw ||
        typeof raw!=="object"
      ){
        return fresh;
      }


      const level=
        Math.max(
          1,
          Math.floor(
            Number(
              raw.mainlineLevel
            )||1
          )
        );


      const points=
        Math.max(
          0,
          Math.floor(
            Number(
              raw.points
            )||0
          )
        );


      const daily=
        (
          raw.daily &&
          typeof raw.daily==="object"
        )
          ?{
              date:
                String(
                  raw.daily.date||
                  todayKey()
                ),

              completed:
                !!raw.daily.completed
            }
          :fresh.daily;


      const soundEnabled=
        typeof raw.soundEnabled==="boolean"
          ?raw.soundEnabled
          :true;


      return{
        mainlineLevel:level,
        points,
        daily,
        soundEnabled
      };
    }


    load(){

      try{

        const raw=
          JSON.parse(
            localStorage.getItem(
              KEY
            )
          );

        return this.normalize(
          raw
        );
      }
      catch{

        return freshData();
      }
    }


    save(){

      /*
        显式构造 payload，
        防止以后 Controller 临时字段被误存。
      */

      const payload={
        mainlineLevel:
          this.data.mainlineLevel,

        points:
          this.data.points,

        daily:{
          date:
            this.data.daily.date,

          completed:
            this.data.daily.completed
        },

        soundEnabled:
          this.data.soundEnabled
      };


      localStorage.setItem(
        KEY,
        JSON.stringify(
          payload
        )
      );
    }


    refreshDaily(){

      const today=
        todayKey();

      if(
        this.data.daily.date!==
        today
      ){

        this.data.daily={
          date:today,
          completed:false
        };

        this.save();

        return true;
      }

      return false;
    }



    get soundEnabled(){
      return(
        this.data.soundEnabled
      );
    }


    setSoundEnabled(
      enabled
    ){

      this.data.soundEnabled=
        !!enabled;

      this.save();

      return(
        this.data.soundEnabled
      );
    }


    toggleSound(){

      return this.setSoundEnabled(
        !this.data.soundEnabled
      );
    }


    get mainlineLevel(){
      return this.data.mainlineLevel;
    }


    get points(){
      return this.data.points;
    }


    get dailyCompleted(){

      this.refreshDaily();

      return(
        this.data.daily.completed
      );
    }


    advanceMainline(
      completedLevel
    ){

      const next=
        Math.max(
          this.data.mainlineLevel,
          Math.floor(
            completedLevel
          )+1
        );

      if(
        next!==
        this.data.mainlineLevel
      ){

        this.data.mainlineLevel=
          next;

        this.save();
      }

      return(
        this.data.mainlineLevel
      );
    }


    addPoints(amount){

      const value=
        Math.max(
          0,
          Math.floor(
            Number(amount)||0
          )
        );

      this.data.points+=
        value;

      this.save();

      return(
        this.data.points
      );
    }


    spendPoints(amount){

      const cost=
        Math.max(
          0,
          Math.floor(
            Number(amount)||0
          )
        );

      if(
        this.data.points<
        cost
      ){
        return false;
      }

      this.data.points-=
        cost;

      this.save();

      return true;
    }


    /*
      每日奖励只允许当天第一次完成时领取。
    */
    completeDaily(
      reward
    ){

      this.refreshDaily();

      if(
        this.data.daily.completed
      ){
        return{
          rewarded:false,
          points:
            this.data.points
        };
      }


      this.data.daily.completed=
        true;

      this.data.points+=
        Math.max(
          0,
          Math.floor(
            Number(reward)||0
          )
        );

      this.save();


      return{
        rewarded:true,
        points:
          this.data.points
      };
    }
  }


  global.ProgressStore=
    ProgressStore;

})(window);
