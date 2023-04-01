(async () => {
    let threshold = 0.5;
    let f = new fabric.Canvas("f", { selection: false });
    f.setBackgroundImage("img/YOLO_threshold.jpg", f.renderAll.bind(f));

    let thresholdData = (await $.ajax("data/filter/threshold.csv")).split(
        "\r\n",
    );
    thresholdData.shift();

    thresholdData = thresholdData.map((row) => {
        row = row.split(",");

        return {
            centerX: row[1] * 1,
            centerY: row[2] * 1,
            width: row[3] * 1,
            height: row[4] * 1,
            threshold: row[5] * 1,
            type: row[0],
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

    const rects = thresholdData.map(
        (arr) =>
            new LabeledRect({
                threshold: arr.threshold,
                left: arr.centerX - arr.width / 2,
                top: arr.centerY - arr.height / 2,
                width: arr.width,
                height: arr.height,
                strokeWidth: 2,
                stroke: "yellow",
                fill: "rgba(255, 255, 0, 0.1)",
                lockRotation: true,
                lockScalingX: true,
                lockScalingY: true,
                lockMovementX: true,
                lockMovementY: true,
                hasControls: false,
                label: `${arr.threshold} ${arr.type}`,
                labelFont: 20,
                labelFill: "yellow",
            }),
    );

    $.each(rects, (i, rect) => {
        rect.set("selectable", false);
        if (rect.threshold >= threshold) {
            f.add(rect);
        }
    });

    $("#filter-bar").on("input change", (e) => {
        threshold = e.target.value;
        $(".threshold-text").text(`Confidence: ${threshold}`);

        $.each(rects, (i, rect) => {
            f.remove(rect);
            if (rect.threshold >= threshold) {
                f.add(rect);
            }
        });
    });
})();
