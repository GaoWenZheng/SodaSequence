(function(){

  const CFG=window.SODA_CONFIG;

  const OUTER_COMMANDS=[
    ["M",-17,-84],
    ["L",-17,-72],
    ["C",-17,-67,-30,-61,-30,-49],
    ["L",-30,62],
    ["C",-30,78,-20,84,-7,84],
    ["L",7,84],
    ["C",20,84,30,78,30,62],
    ["L",30,-49],
    ["C",30,-61,17,-67,17,-72],
    ["L",17,-84]
  ];

  const INNER_COMMANDS=[
    ["M",-14,-70],
    ["C",-14,-64,-25,-58,-25,-48],
    ["L",-25,58],
    ["C",-25,71,-17,78,-6,78],
    ["L",6,78],
    ["C",17,78,25,71,25,58],
    ["L",25,-48],
    ["C",25,-58,14,-64,14,-70]
  ];

  function traceCommands(g,commands){
    for(const cmd of commands){
      if(cmd[0]==="M"){
        g.moveTo(cmd[1],cmd[2]);
      }else if(cmd[0]==="L"){
        g.lineTo(cmd[1],cmd[2]);
      }else if(cmd[0]==="C"){
        g.bezierCurveTo(cmd[1],cmd[2],cmd[3],cmd[4],cmd[5],cmd[6]);
      }
    }
    g.closePath();
  }

  function cubicPoint(p0,p1,p2,p3,t){
    const mt=1-t;
    return{
      x:
        mt*mt*mt*p0.x+
        3*mt*mt*t*p1.x+
        3*mt*t*t*p2.x+
        t*t*t*p3.x,
      y:
        mt*mt*mt*p0.y+
        3*mt*mt*t*p1.y+
        3*mt*t*t*p2.y+
        t*t*t*p3.y
    };
  }

  function sampleCommands(commands,curveSteps=18){
    const points=[];
    let current=null;
    let first=null;

    for(const cmd of commands){
      if(cmd[0]==="M"){
        current={x:cmd[1],y:cmd[2]};
        first={...current};
        points.push({...current});
      }else if(cmd[0]==="L"){
        current={x:cmd[1],y:cmd[2]};
        points.push({...current});
      }else if(cmd[0]==="C"){
        const p0=current;
        const p1={x:cmd[1],y:cmd[2]};
        const p2={x:cmd[3],y:cmd[4]};
        const p3={x:cmd[5],y:cmd[6]};

        for(let i=1;i<=curveSteps;i++){
          points.push(cubicPoint(p0,p1,p2,p3,i/curveSteps));
        }

        current=p3;
      }
    }

    if(first){
      points.push({...first});
    }

    return points;
  }

  function polygonArea(points){
    if(points.length<3)return 0;

    let area=0;

    for(let i=0;i<points.length;i++){
      const a=points[i];
      const b=points[(i+1)%points.length];
      area+=a.x*b.y-b.x*a.y;
    }

    return Math.abs(area)*0.5;
  }

  function intersectHorizontal(a,b,y){
    const dy=b.y-a.y;

    if(Math.abs(dy)<1e-8){
      return{x:b.x,y};
    }

    const t=(y-a.y)/dy;

    return{
      x:a.x+(b.x-a.x)*t,
      y
    };
  }

  function clipBelow(points,threshold){
    const out=[];

    if(!points.length){
      return out;
    }

    for(let i=0;i<points.length;i++){
      const a=points[i];
      const b=points[(i+1)%points.length];

      const aIn=a.y>=threshold;
      const bIn=b.y>=threshold;

      if(aIn&&bIn){
        out.push({...b});
      }else if(aIn&&!bIn){
        out.push(intersectHorizontal(a,b,threshold));
      }else if(!aIn&&bIn){
        out.push(intersectHorizontal(a,b,threshold));
        out.push({...b});
      }
    }

    return out;
  }

  function rotatePoint(p,angle){
    const c=Math.cos(angle);
    const s=Math.sin(angle);

    return{
      x:p.x*c-p.y*s,
      y:p.x*s+p.y*c
    };
  }

  class BottleGeometry{

    constructor(){
      this.innerPolygon=sampleCommands(INNER_COMMANDS,18);

      this.capacityPolygon=
        clipBelow(
          this.innerPolygon,
          CFG.bottle.capacityTop
        );

      this.capacityArea=
        polygonArea(
          this.capacityPolygon
        );
    }

    drawOuter(g){
      traceCommands(g,OUTER_COMMANDS);
    }

    drawInner(g){
      traceCommands(g,INNER_COMMANDS);
    }

    transformedInnerPolygon(angle){
      const bodyOffset={
        x:0,
        y:-CFG.bottle.mouthY
      };

      return this.innerPolygon.map(p=>{
        const relativeToMouth={
          x:p.x+bodyOffset.x,
          y:p.y+bodyOffset.y
        };

        const rotated=
          rotatePoint(
            relativeToMouth,
            angle
          );

        return{
          x:rotated.x-bodyOffset.x,
          y:rotated.y-bodyOffset.y
        };
      });
    }

    bounds(points){
      let minX=Infinity;
      let maxX=-Infinity;
      let minY=Infinity;
      let maxY=-Infinity;

      for(const p of points){
        minX=Math.min(minX,p.x);
        maxX=Math.max(maxX,p.x);
        minY=Math.min(minY,p.y);
        maxY=Math.max(maxY,p.y);
      }

      return{minX,maxX,minY,maxY};
    }

    areaBelow(points,y){
      return polygonArea(
        clipBelow(points,y)
      );
    }

    solveSurfaceY(points,targetArea){
      const b=this.bounds(points);

      if(targetArea<=0){
        return b.maxY+2;
      }

      const fullArea=
        polygonArea(points);

      if(targetArea>=fullArea){
        return b.minY-2;
      }

      let lo=b.minY-4;
      let hi=b.maxY+4;

      for(let i=0;i<42;i++){
        const mid=(lo+hi)/2;
        const area=this.areaBelow(points,mid);

        if(area>targetArea){
          lo=mid;
        }else{
          hi=mid;
        }
      }

      return(lo+hi)/2;
    }
  }

  window.BottleGeometry=
    new BottleGeometry();

})();
