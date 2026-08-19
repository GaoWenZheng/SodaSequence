(function(global){

  const CAPACITY =
    global.SODA_CONFIG.bottle.capacity;

  class GameState{

    constructor(bottles){

      if(!Array.isArray(bottles)){
        throw new TypeError(
          "GameState: bottles 必须是数组"
        );
      }

      this.capacity=CAPACITY;

      this.bottles=
        bottles.map(
          (bottle,index)=>{

            if(!Array.isArray(bottle)){
              throw new TypeError(
                `GameState: 第 ${index} 个瓶子不是数组`
              );
            }

            if(bottle.length>CAPACITY){
              throw new RangeError(
                `GameState: 第 ${index} 个瓶子超过容量 ${CAPACITY}`
              );
            }

            const copy=
              bottle.map(
                (color,slot)=>{

                  if(
                    !Number.isInteger(color) ||
                    color<0
                  ){
                    throw new TypeError(
                      `GameState: bottle=${index}, slot=${slot} 的颜色 ID 非法`
                    );
                  }

                  return color;
                }
              );

            return Object.freeze(copy);
          }
        );

      Object.freeze(
        this.bottles
      );

      Object.freeze(
        this
      );
    }

    get bottleCount(){
      return this.bottles.length;
    }

    bottle(index){

      if(
        !Number.isInteger(index) ||
        index<0 ||
        index>=this.bottleCount
      ){
        throw new RangeError(
          `GameState: bottle index 越界: ${index}`
        );
      }

      return this.bottles[index];
    }

    isEmpty(index){
      return this.bottle(index).length===0;
    }

    clone(){
      return new GameState(
        this.toArray()
      );
    }

    toArray(){
      return this.bottles.map(
        bottle=>[...bottle]
      );
    }

    key(){
      return this.bottles
        .map(
          bottle=>bottle.join(".")
        )
        .join("|");
    }

    equals(other){
      return(
        other instanceof GameState &&
        this.key()===other.key()
      );
    }

    colorCounts(){

      const counts=
        new Map();

      for(const bottle of this.bottles){

        for(const color of bottle){

          counts.set(
            color,
            (counts.get(color)||0)+1
          );
        }
      }

      return counts;
    }
  }

  global.GameState=
    GameState;

})(window);
