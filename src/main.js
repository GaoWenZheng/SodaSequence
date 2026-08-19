(async function(){

  const host=
    document.getElementById(
      "pixiHost"
    );

  if(!window.PIXI){

    document.getElementById(
      "loadingText"
    ).textContent=
      "PixiJS 加载失败，请检查网络连接。";

    return;
  }

  const app=
    new PIXI.Application();

  await app.init({
    backgroundAlpha:0,
    antialias:true,
    autoDensity:true,
    resolution:
      Math.min(
        window.devicePixelRatio||1,
        2
      )
  });

  host.appendChild(
    app.canvas
  );

  document
    .querySelector(
      ".board-shell"
    )
    .classList.add(
      "ready"
    );

  const controller=
    new GameController({
      app,
      host
    });

  controller.start();

  window.sodaGame=
    controller;

})();
