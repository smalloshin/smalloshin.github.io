(() => {
    const canvas = new fabric.Canvas("tc-canvas", { selection: false });

    const directions = [
        { in: "down", out: "up" },
        { in: "up", out: "down" },
        { in: "down", out: "right" },
        { in: "down", out: "left" },
        { in: "up", out: "right" },
        { in: "up", out: "left" },
    ];

    var polygons = {
        up: {
            in: {
                position: {
                    left: 235.25,
                    top: 104.84308192235335,
                },
                points: [
                    {
                        x: 15,
                        y: 6.9916196340004575,
                    },
                    {
                        x: 49,
                        y: 0,
                    },
                    {
                        x: 49,
                        y: 63.923379510860244,
                    },
                    {
                        x: 0,
                        y: 72.912604754575,
                    },
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
                position: {
                    left: 257,
                    top: 297.09701556353684,
                },
                points: [
                    {
                        x: 2.75,
                        y: 4.994014024286059,
                    },
                    {
                        x: 127.75,
                        y: 0,
                    },
                    {
                        x: 133.75,
                        y: 67.91859073028871,
                    },
                    {
                        x: 0,
                        y: 66.76650419018262,
                    },
                ],
            },
            out: {
                position: {
                    left: 57,
                    top: 300.0934239781079,
                },
                points: [
                    {
                        x: 9.75,
                        y: 0.9988028048576894,
                    },
                    {
                        x: 201.75,
                        y: 0,
                    },
                    {
                        x: 200,
                        y: 65.76770138532578,
                    },
                    {
                        x: 0,
                        y: 65.76770138532578,
                    },
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
            y: p.y + polygon.height,
        }));
    }

    function mulCross(pa, pb, pc) {
        return (pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x);
    }

    function inRegion(region, point) {
        let a = mulCross(region[0], region[1], point);
        let b = mulCross(region[1], region[2], point);
        let c = mulCross(region[2], region[3], point);
        let d = mulCross(region[3], region[0], point);

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
