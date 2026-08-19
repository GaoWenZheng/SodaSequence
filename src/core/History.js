(function(global){

  class History{

    constructor(){
      this.undoStack=[];
      this.redoStack=[];
    }

    get canUndo(){
      return this.undoStack.length>0;
    }

    get canRedo(){
      return this.redoStack.length>0;
    }

    get length(){
      return this.undoStack.length;
    }

    clear(){
      this.undoStack.length=0;
      this.redoStack.length=0;
    }

    commit(command){

      if(
        !(command instanceof global.MoveCommand)
      ){
        throw new TypeError(
          "History.commit: command 必须是 MoveCommand"
        );
      }

      if(!command.valid){
        throw new Error(
          "History.commit: 不记录非法命令"
        );
      }

      this.undoStack.push(
        command
      );

      // 新操作发生后，redo 分支失效。
      this.redoStack.length=0;
    }

    undo(currentState){

      if(!this.canUndo){
        return currentState;
      }

      const command=
        this.undoStack.pop();

      const previous=
        command.undo(
          currentState
        );

      this.redoStack.push(
        command
      );

      return previous;
    }

    redo(currentState){

      if(!this.canRedo){
        return currentState;
      }

      const command=
        this.redoStack.pop();

      const next=
        command.redo(
          currentState
        );

      this.undoStack.push(
        command
      );

      return next;
    }
  }

  global.History=
    History;

})(window);
