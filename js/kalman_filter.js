(async () => {
    let canvas = new fabric.Canvas("kf-canvas", { selection: false });
    // canvas.setBackgroundImage("img/test.png", canvas.renderAll.bind(canvas));

    let triangle = new fabric.Triangle({
        width: 10,
        height: 15,
        fill: "red",
        left: 15,
        top: -5,
        angle: 90,
        hasControls: false,
        selectable: false,
        evented: false,
    });

    // start x, y, end x, y
    let line = new fabric.Line([0, 0, 0, 0], {
        left: 0,
        top: 0,
        stroke: "red",
        hasControls: false,
        selectable: false,
        evented: false,
    });

    let arrow = new fabric.Group([triangle, line], {
        angle: 0,
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
    });

    // canvas.add(arrow);

    let rect, isDown, origX, origY;
    canvas.on("mouse:down", function (o) {
        if (o.target != null) return;
        isDown = true;
        let pointer = canvas.getPointer(o.e);
        origX = pointer.x;
        origY = pointer.y;

        rect = new fabric.Rect({
            left: origX,
            top: origY,
            width: pointer.x - origX,
            height: pointer.y - origY,
            fill: "rgba(255, 0, 0, 0)",
            strokeWidth: 2,
            stroke: "red",
            // lockRotation: true,
            // hasControls: false,
        });

        canvas.add(rect);
    });

    canvas.on("mouse:move", function (o) {
        if (!isDown) return;
        let pointer = canvas.getPointer(o.e);

        if (origX > pointer.x) {
            rect.set({ left: Math.abs(pointer.x) });
        }
        if (origY > pointer.y) {
            rect.set({ top: Math.abs(pointer.y) });
        }

        rect.set({ width: Math.abs(origX - pointer.x) });
        rect.set({ height: Math.abs(origY - pointer.y) });

        canvas.renderAll();
    });

    canvas.on("mouse:up", function (o) {
        isDown = false;
        rect?.setCoords();
        if (o.target == null) {
            if (rect.width === 0 && rect.height === 0) {
                canvas.remove();
                rectArr.splice(rectArr.indexOf(rect), 1);
                return;
            }
        }
    });

    let data = await fetch("data/KF/kf.csv").then(async (response) => {
        response = await response.text();
        response = response
            .split("\n")
            .map((row) => row.split(",").map((v) => v * 1));
        response.shift();
        

        return response.reduce((r, v) => {
            let row = r[v[0] - 1] || {
                data: [],
            };

            if (v[7]) {
                row.target = {
                    degree: v[5],
                    length: v[6],
                };
            }

            row.data.push({
                center_x: v[1],
                center_y: v[2],
                width: v[3],
                height: v[4],
            });

            r[v[0] - 1] = row;

            return r;
        }, []);
    });
    console.log(data);
    target_rects = [];
    let idx = 0;
    $("#kf-btn").click(() => {
        $("#kf-btn").text("Next");
        $("#kf-frame").text(idx + 1);
        canvas.clear();
        for (let j = 0; j < target_rects.length; j++) {
            canvas.add(target_rects[j]);
        }
        for (let j = 0; j < 4; j++) {
            if(j!==3){
                rect = new fabric.Rect({
                    left: data[idx].data[j].center_x - data[idx].data[j].width / 2,
                    top: data[idx].data[j].center_y - data[idx].data[j].height / 2,
                    width: data[idx].data[j].width,
                    height: data[idx].data[j].height,
                    fill: "rgba(255, 255, 0, 0)",
                    strokeWidth: 2,
                    stroke: "blue",
                    lockRotation: true,
                    hasControls: false,
                    selectable: false,
                    evented: false,
                });
                canvas.add(rect);
            }
            else{
                rect = new fabric.Rect({
                    left: data[idx].data[j].center_x - data[idx].data[j].width / 2,
                    top: data[idx].data[j].center_y - data[idx].data[j].height / 2,
                    width: data[idx].data[j].width,
                    height: data[idx].data[j].height,
                    fill: "rgba(255, 255, 0, 0)",
                    strokeWidth: 2,
                    stroke: "green",
                    lockRotation: true,
                    hasControls: false,
                    selectable: false,
                    evented: false,
                });
                line.set({
                    x2: data[idx].target.length
                });
                triangle.set({
                    left: data[idx].target.length+15
                });
                let arrow = new fabric.Group([triangle, line], {
                    angle: data[idx].target.degree,
                    left: data[idx].data[3].center_x,
                    top: data[idx].data[3].center_y,
                    selectable: false,
                    evented: false,
                });
                canvas.add(arrow);
                canvas.add(rect);
                target_rects.push(rect);
            }
        }
        if (idx <= 10) {
            idx++;
        }

        if (idx === 10) {
            $("#kf-btn").hide();
        }
    });
})();
