(async () => {
    var frame = 1;
    let canvas = new fabric.Canvas("ac", {
        selection: false,
        uniformScaling: false,
    });
    class Clonable_Rect {
        constructor(
            id,
            label,
            left,
            top,
            width,
            height,
            stroke,
            fill,
            scaleX,
            scaleY,
            strokeDashArray,
        ) {
            this.id = id;
            this.label = label;
            this.left = left;
            this.top = top;
            this.width = width;
            this.height = height;
            this.strokeWidth = 2;
            this.stroke = stroke;
            this.fill = fill;
            this.cornerStyle = "circle";
            this.transparentCorners = false;
            this.lockRotation = true;
            this.hasControls = true;
            this.strokeUniform = true;
            this.noScaleCache = false;
            this.scaleX = scaleX;
            this.scaleY = scaleY;
            this.strokeDashArray = strokeDashArray;
        }
    }
    function cloneRect(rectArr) {
        let clonedRectArr = [];
        rectArr.forEach((item) => {
            let clonedRect = new Clonable_Rect(
                item.id,
                item.label,
                item.left,
                item.top,
                item.width,
                item.height,
                item.stroke,
                item.fill,
                item.scaleX,
                item.scaleY,
                item.strokeDashArray,
            );
            clonedRectArr.push(clonedRect);
        });
        return clonedRectArr;
    }
    function loadRect(clonedRectArr) {
        rectArr = [];
        $("#ac-labels tr").each(function () {
            $(this).remove();
        });
        let row = $(`
        <tr>
            <td style="width: 50px;">ID</td>
            <td>label</td>
            <td>state</td>
        </tr>`);
        $("#ac-labels").append(row);
        clonedRectArr.forEach((item) => {
            let rect = new fabric.Rect({
                id: item.id,
                label: item.label,
                left: item.left,
                top: item.top,
                width: item.width,
                height: item.height,
                strokeWidth: item.strokeWidth,
                stroke: item.stroke,
                fill: item.fill,
                cornerStyle: item.cornerStyle,
                transparentCorners: item.transparentCorners,
                lockRotation: item.lockRotation,
                hasControls: item.hasControls,
                strokeUniform: item.strokeUniform,
                noScaleCache: item.noScaleCache,
                scaleX: item.scaleX,
                scaleY: item.scaleY,
                strokeDashArray: item.strokeDashArray,
            });
            rect.setControlVisible("ml", false); // Middle left
            rect.setControlVisible("mt", false); // Middle top
            rect.setControlVisible("mr", false); // Middle right
            rect.setControlVisible("mb", false); // Middle bottom
            rect.setControlVisible("mtr", false); // Rotation
            rectArr.push(rect);
            occluded_selected = "";
            exit_selected = "";
            if (rect.fill === "rgba(0, 0, 0, 0)") {
                occluded_selected = "selected";
            } else if (rect.fill === "rgba(0, 0, 0, 0.5)") {
                exit_selected = "selected";
            }

            let row = $(`
            <tr>
                <td style="width: 50px;">${rect.id}</td>
                <td>
                    <select id="type" style="padding: 2px;">
                        <option>car</option>
                        <option>bus</option>
                        <option>scooter</option>
                    </select>
                </td>
                <td>
                    <select id="state" style="padding: 2px;">
                        <option>Show</option>
                        <option ${occluded_selected}>Occluded</option>
                        <option ${exit_selected}>Exit</option>
                    </select>
                </td>
            </tr>
            `);
            let testRect = rect;
            let changeType = (e) => {
                if (e.target.value === "car") {
                    testRect.set({
                        stroke: "yellow",
                        fill: "rgba(255, 255, 0, 0.2)",
                        label: e.target.value,
                    });
                } else if (e.target.value === "scooter") {
                    testRect.set({
                        stroke: "green",
                        fill: "rgba(0, 255, 0, 0.2)",
                        label: e.target.value,
                    });
                } else {
                    testRect.set({
                        stroke: "blue",
                        fill: "rgba(0, 0, 255, 0.2)",
                        label: e.target.value,
                    });
                }
            };
            row.find("#type").change((e) => {
                let id = row.find("td:first").text();
                rectArr.forEach((rect) => {
                    if (rect.id == id) {
                        testRect = rect;
                    }
                });
                changeType(e);
                canvas.renderAll();
            });

            let changeState = (e) => {
                if (e.target.value === "Occluded") {
                    testRect.set({
                        strokeDashArray: [5, 5],
                        fill: "rgba(0, 0, 0, 0)",
                    });
                } else if (e.target.value === "Exit") {
                    testRect.set({
                        strokeDashArray: [5, 5],
                        fill: "rgba(0, 0, 0, 0.5)",
                    });
                } else {
                    testRect.set({
                        strokeDashArray: [0, 0],
                    });

                    if (testRect.label === "car") {
                        testRect.set({
                            stroke: "yellow",
                            fill: "rgba(255, 255, 0, 0.2)",
                        });
                    } else if (testRect.label === "scooter") {
                        testRect.set({
                            stroke: "green",
                            fill: "rgba(0, 255, 0, 0.2)",
                        });
                    } else {
                        testRect.set({
                            stroke: "blue",
                            fill: "rgba(0, 0, 255, 0.2)",
                        });
                    }
                }
            };
            row.find("#state").change((e) => {
                let id = row.find("td:first").text();
                rectArr.forEach((rect) => {
                    if (rect.id == id) {
                        testRect = rect;
                    }
                });
                changeState(e);
                canvas.renderAll();
            });

            $("#ac-labels").append(row);
        });
        return rectArr;
    }

    $("#ac-finish").hide();
    $("#ac-tip-finish").hide();
    $("#ac-timer").hide();
    $("#ac-labels").hide();

    canvas.setBackgroundImage(
        "data/annotation/frame_000360.PNG",
        canvas.renderAll.bind(canvas),
    );
    canvas.renderAll();
    let id = 0;
    let label = "car";
    let rect, isDown, origX, origY;
    let sec = 0,
        ms = 0,
        timer;
    let rectframeArr = [];
    let rectArr = [];

    $("#ac-start").click(() => {
        $("#ac-start").hide();
        $("#ac-tip-start").hide();
        $("#ac-finish").show();
        $("#ac-timer").show();
        $("#next-frame").prop("disabled", false);
        $(".canvas-wrapper").css("cursor", "auto");
        $(".canvas-wrapper").css("pointer-events", "auto");

        let now = new Date().getTime();
        timer = setInterval(() => {
            let timeElapsed = new Date().getTime() - now;
            sec = timeElapsed.toString().slice(0, -3);
            ms = timeElapsed % 1000;
            $("#ac-timer").text(`${sec}.${ms}s`);
        }, 1);
    });

    $("#ac-finish").click(() => {
        clearInterval(timer);
        $("#ac-overlay").show();
        $("#ac-timer").hide();
        $("#ac-finish").hide();
        $("#tip-finish").hide();
        $("#ac-totalSec").text(`Time: ${sec}.${ms}s`);
        $("#ac-perSec").text(
            `Time cost per frame (average): ${
                Math.round((parseInt(sec) / 41) * 100) / 100
            } s`,
        );
        $("#next-frame").prop("disabled", true);
        $("#prev-frame").prop("disabled", true);
    });

    $("#next-frame").click(() => {
        console.log(frame);
        $("#ac-labels tr").each(function () {
            $(this).css({ "background-color": "transparent", border: "none" });
        });
        if (rectframeArr.length > frame) {
            canvas.setBackgroundImage(
                "data/annotation/frame_000" + (frame + 360).toString() + ".PNG",
                canvas.renderAll.bind(canvas),
            );
            console.log(
                "data/annotation/frame_000" + (frame + 360).toString() + ".PNG",
            );
            canvas.renderAll();
            rectArr.forEach((item) => {
                if (item.fill == "rgba(0, 0, 0, 0.5)") {
                    rectframeArr.forEach((element, count) => {
                        if (count >= frame) {
                            console.log("eeee1");
                            element.forEach((rrect) => {
                                console.log("eeee2");
                                if (rrect.id == item.id) {
                                    element.splice(element.indexOf(rrect), 1);
                                }
                            });
                        }
                    });
                } else {
                    rectframeArr.forEach((element, count) => {
                        if (count >= frame) {
                            let is_in = false;
                            element.forEach((rrect) => {
                                if (rrect.id == item.id) {
                                    is_in = true;
                                }
                            });
                            if (!is_in) {
                                itemm = new Clonable_Rect(
                                    item.id,
                                    item.label,
                                    item.left,
                                    item.top,
                                    item.width,
                                    item.height,
                                    item.stroke,
                                    item.fill,
                                    item.scaleX,
                                    item.scaleY,
                                    item.strokeDashArray,
                                );
                                element.push(itemm);
                            }
                        }
                    });
                }
            });
            canvas.clear();
            rectframeArr[frame - 1] = cloneRect(rectArr);
            rectArr = loadRect(rectframeArr[frame]);
            rectArr.forEach((item) => {
                canvas.add(item);
            });
            canvas.renderAll();
        } else {
            canvas.setBackgroundImage(
                "data/annotation/frame_000" + (frame + 360).toString() + ".PNG",
                canvas.renderAll.bind(canvas),
            );
            console.log(
                "data/annotation/frame_000" + (frame + 360).toString() + ".PNG",
            );
            canvas.renderAll();
            if (rectframeArr.length == frame) {
                rectframeArr[frame - 1] = cloneRect(rectArr);
            } else {
                rectframeArr.push(cloneRect(rectArr));
                rectArr.forEach((element) => {
                    if (element.fill == "rgba(0, 0, 0, 0.5)") {
                        canvas.remove(element);
                        rectArr.splice(rectArr.indexOf(element), 1);
                    }
                });
            }
        }
        if (frame == 40) {
            $("#next-frame").prop("disabled", true);
        }
        if (frame >= 1) {
            $("#prev-frame").prop("disabled", false);
        }
        frame++;
        console.log(rectframeArr);
    });
    $("#prev-frame").click(() => {
        console.log(frame);
        $("#ac-labels tr").each(function () {
            $(this).css({ "background-color": "transparent", border: "none" });
        });
        if (frame == 1) {
            return;
        }
        rectframeArr[frame - 1] = cloneRect(rectArr);
        rectArr = loadRect(rectframeArr[frame - 2]);
        console.log(
            "data/annotation/frame_000" + (frame + 358).toString() + ".PNG",
        );
        canvas.setBackgroundImage(
            "data/annotation/frame_000" + (frame + 358).toString() + ".PNG",
            canvas.renderAll.bind(canvas),
        );
        canvas.renderAll();
        canvas.clear();
        rectArr.forEach((item) => {
            canvas.add(item);
        });
        canvas.renderAll();
        if (frame == 2) {
            $("#prev-frame").prop("disabled", true);
        }
        if (frame <= 41) {
            $("#next-frame").prop("disabled", false);
        }
        frame--;
    });

    fabric.Object.prototype.controls.deleteControl.mouseUpHandler =
        deleteObject;
    function deleteObject(eventData, transform) {
        let target = transform.target;
        let canvas = target.canvas;
        rectArr = rectArr.filter((item) => item != target);
        canvas.remove(target);
        canvas.requestRenderAll();
        $("#ac-labels tr").each(function () {
            if ($(this).find("td:first").text() == target.id) {
                $(this).remove();
            }
        });
        rectframeArr.forEach((element) => {
            element.forEach((item) => {
                if (item.id == target.id) {
                    element.splice(element.indexOf(item), 1);
                }
            });
        });
    }
    canvas.on("mouse:down", function (o) {
        if (o.target != null) {
            isNull = false;
            $("#ac-labels tr").each(function () {
                if ($(this).find("td:first").text() == o.target.id) {
                    $(this).css({
                        "background-color": "yellow",
                        border: "1px dashed black",
                    });
                } else {
                    $(this).css({
                        "background-color": "transparent",
                        border: "none",
                    });
                }
            });
            return;
        }
        $("#ac-labels tr").each(function () {
            $(this).css({ "background-color": "transparent", border: "none" });
        });
        isDown = true;
        isNull = true;
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
            strokeWidth: 2,
            stroke: "yellow",
            fill: "rgba(255, 255, 0, 0.2)",
            cornerStyle: "circle",
            transparentCorners: false,
            lockRotation: true,
            hasControls: true,
            strokeUniform: true,
            noScaleCache: false,
        });
        rect.setControlVisible("ml", false); // Middle left
        rect.setControlVisible("mt", false); // Middle top
        rect.setControlVisible("mr", false); // Middle right
        rect.setControlVisible("mb", false); // Middle bottom
        rect.setControlVisible("mtr", false); // Rotation
        canvas.add(rect);
        rectArr.push(rect);
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
        if (rectArr.length == 0) $("#ac-labels").hide();
        else $("#ac-labels").show();
        if (isNull) {
            $("#ac-labels tr").each(function () {
                $(this).css("background-color", "transparent");
            });
            if (rect.width < 10 || rect.height < 10) {
                canvas.remove(rect);
                rectArr.splice(rectArr.indexOf(rect), 1);
                if (rectArr.length == 0) $("#ac-labels").hide();
                else $("#ac-labels").show();
                return;
            } else {
                rectframeArr.forEach((element, index) => {
                    if (index > frame - 1) {
                        item = rect;
                        let clonedRect = new Clonable_Rect(
                            item.id,
                            item.label,
                            item.left,
                            item.top,
                            item.width,
                            item.height,
                            item.stroke,
                            item.fill,
                            item.scaleX,
                            item.scaleY,
                            item.strokeDashArray,
                        );
                        element.push(clonedRect);
                    }
                });
            }
            let { tl, tr, bl, br } = rect.lineCoords;
            let row = $(`
            <tr>
                <td style="width: 50px;">${rect.id}</td>
                <td>
                    <select id="type" style="padding: 2px;">
                        <option>car</option>
                        <option>bus</option>
                        <option>scooter</option>
                    </select>
                </td>
                <td>
                    <select id="state" style="padding: 2px;">
                        <option>Show</option>
                        <option>Occluded</option>
                        <option>Exit</option>
                    </select>
                </td>
            </tr>
            `);

            $("#ac-labels").show();
            $("#ac-labels").append(row);

            let testRect = rect;
            let changeType = (e) => {
                if (e.target.value === "car") {
                    testRect.set({
                        stroke: "yellow",
                        fill: "rgba(255, 255, 0, 0.2)",
                        label: e.target.value,
                    });
                } else if (e.target.value === "scooter") {
                    testRect.set({
                        stroke: "green",
                        fill: "rgba(0, 255, 0, 0.2)",
                        label: e.target.value,
                    });
                } else {
                    testRect.set({
                        stroke: "blue",
                        fill: "rgba(0, 0, 255, 0.2)",
                        label: e.target.value,
                    });
                }
            };
            row.find("#type").change((e) => {
                let id = row.find("td:first").text();
                rectArr.forEach((rect) => {
                    if (rect.id == id) {
                        testRect = rect;
                    }
                });
                changeType(e);
                canvas.renderAll();
            });

            let changeState = (e) => {
                if (e.target.value === "Occluded") {
                    testRect.set({
                        strokeDashArray: [5, 5],
                        fill: "rgba(0, 0, 0, 0)",
                    });
                } else if (e.target.value === "Exit") {
                    testRect.set({
                        strokeDashArray: [5, 5],
                        fill: "rgba(0, 0, 0, 0.5)",
                    });
                } else {
                    testRect.set({
                        strokeDashArray: [0, 0],
                    });
                    if (testRect.label === "car") {
                        testRect.set({
                            stroke: "yellow",
                            fill: "rgba(255, 255, 0, 0.2)",
                        });
                    } else if (testRect.label === "scooter") {
                        testRect.set({
                            stroke: "green",
                            fill: "rgba(0, 255, 0, 0.2)",
                        });
                    } else {
                        testRect.set({
                            stroke: "blue",
                            fill: "rgba(0, 0, 255, 0.2)",
                        });
                    }
                }
            };
            row.find("#state").change((e) => {
                let id = row.find("td:first").text();
                rectArr.forEach((rect) => {
                    if (rect.id == id) {
                        testRect = rect;
                    }
                });
                changeState(e);
                canvas.renderAll();
            });
            id++;
        }
    });
})();
