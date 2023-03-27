(() => {
    const Questions = [
        {
            src: "./img/iou/scooter3.jpg",
            path: [
                { x: 236, y: 24 },
                { x: 236, y: 87 },
                { x: 285, y: 87 },
                { x: 285, y: 24 },
            ],
            width: 297,
            height: 235,
            label: "scooter",
        },
        {
            src: "./img/iou/car1.jpg",
            path: [
                { x: 53, y: 20 },
                { x: 53, y: 59 },
                { x: 113, y: 59 },
                { x: 113, y: 20 },
            ],
            width: 246,
            height: 163,
            label: "car",
        },
        {
            src: "./img/iou/car3.jpg",
            path: [
                { x: 12, y: 25 },
                { x: 12, y: 73 },
                { x: 51, y: 73 },
                { x: 51, y: 25 },
            ],
            width: 156,
            height: 110,
            label: "car",
        },
        {
            src: "./img/iou/bigcar1.jpg",
            path: [
                { x: 18, y: 9 },
                { x: 18, y: 90 },
                { x: 112, y: 90 },
                { x: 112, y: 9 },
            ],
            width: 194,
            height: 172,
            label: "bus",
        },
        {
            src: "./img/iou/scooter2.jpg",
            path: [
                { x: 58, y: 29 },
                { x: 58, y: 89 },
                { x: 98, y: 89 },
                { x: 98, y: 29 },
            ],
            width: 121,
            height: 154,
            label: "scooter",
        },
        {
            src: "./img/iou/car2.jpg",
            path: [
                { x: 18, y: 78 },
                { x: 18, y: 126 },
                { x: 84, y: 126 },
                { x: 84, y: 78 },
            ],
            width: 200,
            height: 264,
            label: "car",
        },
        {
            src: "./img/iou/bigcar3.jpg",
            path: [
                { x: 98, y: 59 },
                { x: 98, y: 135 },
                { x: 198, y: 135 },
                { x: 198, y: 59 },
            ],
            width: 405,
            height: 266,
            label: "bus",
        },
        {
            src: "./img/iou/bigcar2.jpg",
            path: [
                { x: 46, y: 4 },
                { x: 46, y: 90 },
                { x: 119, y: 90 },
                { x: 119, y: 4 },
            ],
            width: 206,
            height: 203,
            label: "bus",
        },
        {
            src: "./img/iou/scooter1.jpg",
            path: [
                { x: 138, y: 83 },
                { x: 138, y: 182 },
                { x: 196, y: 182 },
                { x: 196, y: 83 },
            ],
            width: 247,
            height: 269,
            label: "scooter",
        },
        {
            src: "./img/iou/car4.jpg",
            path: [
                { x: 21, y: 7 },
                { x: 21, y: 43 },
                { x: 62, y: 43 },
                { x: 62, y: 7 },
            ],
            width: 227,
            height: 168,
            label: "car",
        },
    ];

    const image = $(".iou-img img");
    const iouBtn = $(".iou-btn");

    let canvas = new fabric.Canvas("iou-canvas", { selection: false, uniformScaling: false });
    let rect = undefined,
        pointer,
        isDown = false;

    let questionIndex = 0;
    // fabric.Object.prototype.controls.deleteControl = new fabric.deleteControl({
    // });
    let canvasEvent = () => {
        canvas.on("mouse:down", function (o) {
            isDown = true;
            pointer = canvas.getPointer(o.e);
            origX = pointer.x;
            origY = pointer.y;
            pointer = canvas.getPointer(o.e);
            rect = new fabric.Rect({
                left: origX,
                top: origY,
                width: pointer.x - origX,
                height: pointer.y - origY,
                angle: 0,
                fill: "rgba(255, 255, 0, 0.5)",
                cornerStyle: "circle",
                lockRotation: true,
                hasControls: true,
                noScaleCache: false,
                strokeUniform: true,
            });
            rect.setControlVisible("ml", false); // Middle left
            rect.setControlVisible("mt", false); // Middle top
            rect.setControlVisible("mr", false); // Middle right
            rect.setControlVisible("mb", false); // Middle bottom
            rect.setControlVisible("mtr", false); // Rotation
            rect.setControlVisible("deleteControl", false);
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
            rect.setCoords();
            canvas.off("mouse:down").off("mouse:move").off("mouse:up");
        });
    };

    function IoU(p1, p2) {
        let xA = Math.max(p1.tl.x, p2.tl.x);
        let yA = Math.max(p1.tl.y, p2.tl.y);
        let xB = Math.min(p1.br.x, p2.br.x);
        let yB = Math.min(p1.br.y, p2.br.y);

        let interArea = Math.max(0, xB - xA + 1) * Math.max(0, yB - yA + 1);

        boxAArea = (p1.br.x - p1.tl.x + 1) * (p1.br.y - p1.tl.y + 1);
        boxBArea = (p2.br.x - p2.tl.x + 1) * (p2.br.y - p2.tl.y + 1);

        return interArea / (boxAArea + boxBArea - interArea);
    }

    const classArr = ["bus", "car", "scooter"];
    $.each(classArr, (val, text) => {
        $("#iou-class").append(
            $("<option></option>").attr("value", text).text(text),
        );
    });

    function showQuestion() {
        if (rect) {
            canvas.remove(rect);
            rect = undefined;
        }

        image.attr("src", Questions[questionIndex].src);
        canvas.setHeight(Questions[questionIndex].height);
        canvas.setWidth(Questions[questionIndex].width);
        canvasEvent();
    }

    iouBtn.click(() => {
        if (iouBtn.text() == "Submit") {
            canvas.discardActiveObject();
            canvas.renderAll();
            rect.selectable = false;
            rect.hasControls = false;
            iouBtn.text("Try Next");
            const target = {
                tl: Questions[questionIndex].path[0],
                br: Questions[questionIndex].path[2],
            };
            let current = { tl: rect.getCoords()[0], br: rect.getCoords()[2] };
            console.log(current, target);
            let iou = ((IoU(current, target) * 1000) | 0) / 10;
            
            $("#iou-result").text(`${iou}%`);

            if (
                $("#iou-class").val() == Questions[questionIndex].label
            ) {
                $("#iou-result-correct").text("Label correct!");
                nextBtn.hide();
            } else {
                $("#iou-result-correct").text("Wrong label!");
            }
        } else if (iouBtn.text() == "Try Next") {
            if (questionIndex == Questions.length - 1) {
                $("#iou-result-correct").text("Game is over! Scroll down to another section.");
                iouBtn.hide();
            }
            else{
                questionIndex = (questionIndex + 1) % Questions.length;
                showQuestion();
                iouBtn.text("Submit");
                $("#iou-result-correct").text("");
                $("#iou-result").text(` To be calculated...`);
            }
            
        } else {
            iouBtn.text("Try Next");
        }
    });

    showQuestion();
})();
