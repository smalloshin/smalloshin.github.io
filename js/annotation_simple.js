(async () => {
    $("#btn-finish").hide();
    $("#tip-finish").hide();
    $("#btn-reset").hide();
    $("#labels").hide();

    let canvas = new fabric.Canvas("annotation-canvas");
    canvas.setBackgroundImage("img/Ko-PER_Intersection_Sequence1d_KAB_SK_1_undist_Moment.jpg", canvas.renderAll.bind(canvas));

    let yoloData = (await $.ajax("data/yolo/Coordination_YOLO.csv")).split(
        "\r\n",
    );
    yoloData.shift();
    yoloData = yoloData.map((row) => {
        row = row.split(",");

        return {
            type: row[0],
            centerX: row[1] * 1,
            centerY: row[2] * 1,
            width: row[3] * 1,
            height: row[4] * 1,
        };
    });

    let LabeledRect = fabric.util.createClass(fabric.Rect, {
        type: "labeledRect",
        initialize: function (options) {
            options || (options = {});
            this.callSuper("initialize", options);
            this.set("label", options.label || "");
            this.set("labelFont", options.labelFont || "");
            this.set("labelFill", options.labelFill || "");
        },
        toObject: function () {
            return fabric.util.object.extend(this.callSuper("toObject"), {
                label: this.get("label"),
                labelFont: this.get("labelFont"),
                labelFill: this.get("labelFill"),
            });
        },
        _render: function (ctx) {
            this.callSuper("_render", ctx);
            ctx.font = this.labelFont;
            ctx.fillStyle = this.labelFill;
            ctx.fillText(this.label, -this.width / 2, -this.height / 2 - 5);
        },
    });

    const rects = yoloData.map(
        (arr) =>
            new LabeledRect({
                left: arr.centerX - arr.width / 2,
                top: arr.centerY - arr.height / 2,
                width: arr.width,
                height: arr.height,
                strokeWidth: 2,
                stroke: "red",
                fill: "rgba(255, 0, 0, 0.6)",
                lockRotation: true,
                lockScalingX: true,
                lockScalingY: true,
                lockMovementX: true,
                lockMovementY: true,
                hasControls: false,
                label: arr.type,
                labelFont: 20,
                labelFill: "red",
            }),
    );

    let id = 0;
    let label = "car";
    let rect, isDown, origX, origY;
    let sec = 0,
        ms = 0,
        timer;
    let rectArr = [];

    $("#btn-start").click(() => {
        $("#overlay").hide();
        $("#btn-start").hide();
        $("#tip-start").hide();
        $("#btn-finish").show();
        $("#tip-finish").show();
    });

    $("#btn-finish").click(() => {
        $.each(rects, (i, rect) => {
            canvas.add(rect);
        });
        $("#overlay").show();
        $("#btn-finish").hide();
        $("#tip-finish").hide();
        $("#btn-reset").show();
    });

    $("#btn-reset").click(() => {
        $("#btn-start").show();
        $("#tip-start").show();
        $("#btn-reset").hide();
        $.each(rects, (i, rect) => {
            canvas.remove(rect);
        });
        $.each(rectArr, (i, rect) => {
            canvas.remove(rect);
        });
    })

    let deleteIcon =
        "data:image/svg+xml,%3C%3Fxml version='1.0' encoding='utf-8'%3F%3E%3C!DOCTYPE svg PUBLIC '-//W3C//DTD SVG 1.1//EN' 'http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd'%3E%3Csvg version='1.1' id='Ebene_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' width='595.275px' height='595.275px' viewBox='200 215 230 470' xml:space='preserve'%3E%3Ccircle style='fill:%23F44336;' cx='299.76' cy='439.067' r='218.516'/%3E%3Cg%3E%3Crect x='267.162' y='307.978' transform='matrix(0.7071 -0.7071 0.7071 0.7071 -222.6202 340.6915)' style='fill:white;' width='65.545' height='262.18'/%3E%3Crect x='266.988' y='308.153' transform='matrix(0.7071 0.7071 -0.7071 0.7071 398.3889 -83.3116)' style='fill:white;' width='65.544' height='262.179'/%3E%3C/g%3E%3C/svg%3E";
    let deleteIc = document.createElement("img");
    deleteIc.src = deleteIcon;
    fabric.Object.prototype.controls.deleteControl = new fabric.Control({
        x: 0.5,
        y: -0.5,
        offsetX: 20,
        offsetY: -20,
        cursorStyle: "pointer",
        mouseUpHandler: deleteObject,
        render: renderIcon,
        cornerSize: 24,
    });

    function deleteObject(eventData, transform) {
        let target = transform.target;
        let canvas = target.canvas;
        rectArr = rectArr.filter((item) => item != target);
        canvas.remove(target);
        canvas.requestRenderAll();
        $("#labels tr").each(function () {
            if ($(this).find("td:first").text() == target.id) {
                $(this).remove();
            }
        });

        rectArr.forEach((item) => {
            if (item.id > target.id) {
                item.id = item.id - 1;
                $("#labels tr").each(function () {
                    if ($(this).find("td:first").text() == item.id + 1) {
                        $(this).find("td:first").text(item.id);
                    }
                });
            }
        });

        if (rectArr.length == 0) $("#labels").hide();
        else $("#labels").show();
        id--;

    }
    function renderIcon(ctx, left, top, styleOverride, fabricObject) {
        let size = this.cornerSize;
        ctx.save();
        ctx.translate(left, top);
        ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle));
        ctx.drawImage(deleteIc, -size / 2, -size / 2, size, size);
        ctx.restore();
    }

    canvas.on("mouse:down", function (o) {
        if (o.target != null) return;
        isDown = true;
        let pointer = canvas.getPointer(o.e);
        origX = pointer.x;
        origY = pointer.y;

        rect = new fabric.Rect({
            id,
            label,
            left: origX,
            top: origY,
            width: pointer.x - origX,
            height: pointer.y - origY,
            fill: "rgba(255, 255, 0, 0.6)",
            strokeWidth: 2,
            stroke: "yellow",
            lockRotation: true,
        });

        canvas.add(rect);
        rectArr.push(rect);
    });

    canvas.on("mouse:move", function (o) {
        let pointer = canvas.getPointer(o.e);
        if (!isDown) return;
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
    })
})();