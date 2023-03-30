(() => {
    const canvas = new fabric.Canvas("tc-canvas", { selection: false });

    const directions = [
        { in: "down", out: "up" },
        { in: "down", out: "right" },
        { in: "down", out: "left" },
        { in: "left", out: "right" },
        { in: "right", out: "left" },
    ];

    var polygons = {
        up: {
            in: {
                position: {
                    left: -1,
                    top: -1,
                },
                points: [
                    { x: 0, y: 0 },
                    { x: 0, y: 0 },
                    { x: 0, y: 0 },
                    { x: 0, y: 0 },
                ],
            },
            out: {
                position: {
                    left: 283.25,
                    top: 104.84308192235332,
                },
                points: [
                    {
                        x: 0,
                        y: 0,
                    },
                    {
                        x: 36,
                        y: 0.9988028048572204,
                    },
                    {
                        x: 48,
                        y: 64.92218231571746,
                    },
                    {
                        x: 0,
                        y: 66.91978792543188,
                    },
                ],
            },
        },
        left: {
            in: {
                position: {
                    left: 1.25,
                    top: 192.73772874978624,
                },
                points: [
                    {
                        x: 0,
                        y: 21.973661706858252,
                    },
                    {
                        x: 197,
                        y: 0,
                    },
                    {
                        x: 199,
                        y: 31.961689755430115,
                    },
                    {
                        x: 1,
                        y: 62.92457670600305,
                    },
                ],
            },
            out: {
                position: {
                    left: -3.75,
                    top: 159.77723618949886,
                },
                points: [
                    {
                        x: 0,
                        y: 31.961689755430143,
                    },
                    {
                        x: 203,
                        y: 0,
                    },
                    {
                        x: 204,
                        y: 29.964084145715788,
                    },
                    {
                        x: 2,
                        y: 54.934154267145544,
                    },
                ],
            },
        },
        down: {
            in: {
                position: { left: 211.16996465594949, top: 269.75191299691915 },
                points: [
                    { x: 5.996307692307639, y: 0 },
                    { x: 164.8984615384615, y: 2.7940670975148123 },
                    { x: 136.91569230769227, y: 94.5990288135348 },
                    { x: 0, y: 94.79860177197702 },
                ],
            },
            out: {
                position: {
                    left: -1,
                    top: -1,
                },
                points: [
                    { x: 0, y: 0 },
                    { x: 0, y: 0 },
                    { x: 0, y: 0 },
                    { x: 0, y: 0 },
                ],
            },
        },
        right: {
            in: {
                position: {
                    left: 389.25,
                    top: 132.29455276209973,
                },
                points: [
                    {
                        x: 3.5,
                        y: 6.99161963400087,
                    },
                    {
                        x: 160.5,
                        y: 0,
                    },
                    {
                        x: 159,
                        y: 27.482683427399166,
                    },
                    {
                        x: 0,
                        y: 36.47190867111388,
                    },
                ],
            },
            out: {
                position: {
                    left: 393.25,
                    top: 160.7760389943561,
                },
                points: [
                    {
                        x: 0,
                        y: 5.992816829143152,
                    },
                    {
                        x: 158,
                        y: 0,
                    },
                    {
                        x: 164,
                        y: 61.925773901145874,
                    },
                    {
                        x: 1,
                        y: 118.8575337780058,
                    },
                ],
            },
        },
    };

    var tracks = [];

    const colorsProperty = {
        red: {
            fill: "rgba(255, 0, 0, 0.6)",
            stroke: "red",
        },
        green: {
            fill: "rgba(0, 255, 0, 0.6)",
            stroke: "green",
        },
    };

    var scaleRatio = 1;

    function positionHandler(dim, finalMatrix, fabricObject) {
        return {
            x: fabricObject.points[this.pointIndex].x + fabricObject.left,
            y: fabricObject.points[this.pointIndex].y + fabricObject.top,
        };
    }

    function actionHandler(polygon, pointIndex, event, transform, x, y) {
        polygon.points[pointIndex] = {
            x: x - polygon.left,
            y: y - polygon.top,
        };

        let leftMove = Math.min(...polygon.points.map((p) => p.x));
        let topMove = Math.min(...polygon.points.map((p) => p.y));

        polygon.points = polygon.points.map((p) => ({
            x: p.x - leftMove,
            y: p.y - topMove,
        }));

        let newPossition = {
            x: polygon.left + leftMove,
            y: polygon.top + topMove,
        };

        polygon._setPositionDimensions({});
        polygon.setPositionByOrigin(newPossition, "left", "top");

        calcCar();

        return true;
    }

    function createPolygon(data, color) {
        let polygon = new fabric.Polygon(data.points, {
            strokeWidth: 1,
            objectCaching: false,
            ...data.position,
            ...color,
        });

        polygon.controls = polygon.points.map(
            (_, index) =>
                new fabric.Control({
                    positionHandler,
                    actionHandler: actionHandler.bind(this, polygon, index),
                    pointIndex: index,
                }),
        );

        canvas.add(polygon);

        return polygon;
    }

    function getRegion(polygon) {
        return polygon.points.map((p) => ({
            x: p.x + polygon.left,
            y: p.y + polygon.top,
        }));
    }

    function mulCross(pa, pb, pc) {
        return (pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x);
    }

    function inRegion(region, point) {
        let a = mulCross(region[3], region[0], point);
        let b = mulCross(region[0], region[1], point);
        let c = mulCross(region[1], region[2], point);
        let d = mulCross(region[2], region[3], point);

        if (
            (a >= 0 && b >= 0 && c >= 0 && d >= 0) ||
            (a <= 0 && b <= 0 && c <= 0 && d <= 0)
        ) {
            return true;
        }

        return false;
    }

    const table = $(".tc-table td:nth-child(2)");

    function calcCar() {
        const region = Object.keys(polygons).reduce((r, v) => {
            r[v] = {
                in: getRegion(polygons[v].in.polygon),
                out: getRegion(polygons[v].out.polygon),
            };
            return r;
        }, {});

        var result = [0, 0, 0, 0, 0, 0];

        for (let pos in tracks) {
            for (let direct in directions) {
                if (
                    !inRegion(
                        region[directions[direct].in].in,
                        tracks[pos].start,
                    )
                )
                    continue;
                if (
                    !inRegion(
                        region[directions[direct].out].out,
                        tracks[pos].end,
                    )
                )
                    continue;
                result[direct]++;
                break;
            }
        }

        for (let i = 0; i < 6; i++) {
            $(table[i]).text(result[i]);
        }
    }

    fabric.Image.fromURL("img/track.jpg", async (img) => {
        const width = $(".tc-container .canvas-container").width();
        scaleRatio = width / img.width;
        const height = img.height * scaleRatio;

        canvas.setDimensions({
            width: width,
            height,
        });
        canvas
            .setBackgroundImage(
                img.set({
                    scaleX: scaleRatio,
                    scaleY: scaleRatio,
                }),
            )
            .renderAll();

        for (let data in polygons) {
            polygons[data].in.polygon = createPolygon(
                polygons[data].in,
                colorsProperty.red,
            );
            polygons[data].out.polygon = createPolygon(
                polygons[data].out,
                colorsProperty.green,
            );
        }

        tracks = await fetch("data/track/track_data_in_out.csv").then(
            async (response) => {
                response = (await response.text())
                    .split("\r\n")
                    .map((row) => row.split(",").map((data) => data * 1));

                response.shift();

                return response.reduce((r, v) => {
                    if (r[v[2]]) {
                        r[v[2]].end = {
                            x: v[0] * scaleRatio,
                            y: v[1] * scaleRatio,
                        };
                    } else {
                        r[v[2]] = {
                            start: {
                                x: v[0] * scaleRatio,
                                y: v[1] * scaleRatio,
                            },
                        };
                    }
                    return r;
                }, []);
            },
        );

        calcCar();
        canvas.on("object:moving", calcCar);
    });
})();
