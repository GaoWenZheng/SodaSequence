(function(global){

  class MoveCommand{

    constructor(
      beforeState,
      from,
      to
    ){

      if(
        !(beforeState instanceof global.GameState)
      ){
        throw new TypeError(
          "MoveCommand: beforeState 必须是 GameState"
        );
      }

      this.plan=
        global.SodaRules.inspectMove(
          beforeState,
          from,
          to
        );

      this.valid=
        this.plan.valid;

      this.before=
        beforeState.clone();

      this.beforeKey=
        this.before.key();

      this.after=
        this.valid
          ? global.SodaRules.applyPlan(
              beforeState,
              this.plan
            )
          : null;

      this.afterKey=
        this.after
          ? this.after.key()
          : null;

      Object.freeze(
        this
      );
    }

    execute(currentState){

      if(!this.valid){
        throw new Error(
          "MoveCommand.execute: 非法移动"
        );
      }

      if(
        currentState.key()!==
        this.beforeKey
      ){
        throw new Error(
          "MoveCommand.execute: 当前 GameState 与命令创建时不一致"
        );
      }

      return this.after.clone();
    }

    undo(currentState){

      if(!this.valid){
        throw new Error(
          "MoveCommand.undo: 非法移动"
        );
      }

      if(
        currentState.key()!==
        this.afterKey
      ){
        throw new Error(
          "MoveCommand.undo: 当前 GameState 不是该命令的执行结果"
        );
      }

      return this.before.clone();
    }

    redo(currentState){
      return this.execute(
        currentState
      );
    }
  }

  global.MoveCommand=
    MoveCommand;

})(window);
