(() => {
    const nextBtn = $(".hungarian-container #next-btn");
    let buttonContainer = $(".hungarian-container tr:nth-child(n+3):nth-child(-n+8) td:last-child");
    let rowTr = $(".hungarian-container tr:nth-child(n+3):nth-child(-n+8)");
    rowTr = rowTr.map(row => $(rowTr[row]).find(`td:nth-child(n+${row ? 2 : 3}):nth-child(-n+${row ? 7 : 8})`));

    let svg = d3.select(".hungarian-container svg");

    const space = 48;
    const leftPadding = 120;
    const topPadding = 120;
    let circles = [];

    for (let y = 0; y < 6; y++) {
        let row = []
        for (let x = 0; x < 6; x++) {
            row.push(
                svg
                    .append("circle")
                    .attr("cx", leftPadding + space * x)
                    .attr("cy", topPadding + space * y)
                    .attr("r", 15)
                    .attr("stroke", "none")
                    .attr("stroke-width", 3)
                    .attr("fill", "none")
            )
        }
        circles.push(row)
    }

    let buttonLast = 6;

    for (let i = 0; i < 6; i++) {
        $(buttonContainer[i]).append(
            $("<button>Reduce</button>")
                .click(event => {
                    let minNum = [].reduce.call(rowTr[i], (r, v) => {
                        if ($(v).text() * 1 < r) {
                            return $(v).text() * 1;
                        }
                        return r;
                    }, 100);

                    for (let j = 0; j < 6; j++) {
                        let val = $(rowTr[i][j]).text() * 1 - minNum;
                        if (val == 0) {
                            circles[i][j].attr("stroke", "red");
                        }
                        $(rowTr[i][j]).text(val);
                    }
                    $(event.target).remove();

                    if (--buttonLast == 0) Step2();
                })
        );
    }

    const drawLines = [[1, 3, 4], [0, 5]];

    function Step2() {
        const lineContainer = svg.append("g");

        for (let col in drawLines[0]) {
            lineContainer
                .append("line")
                .attr("stroke", "red")
                .attr("stroke-width", 14)
                .attr("x1", leftPadding + space * drawLines[0][col])
                .attr("y1", topPadding - space - 10)
                .attr("x2", leftPadding + space * drawLines[0][col])
                .attr("y2", topPadding + space * 5 + 10)
                .attr("stroke-opacity", 0.5)
                .attr("stroke-linecap", "round")
        }

        for (let col in drawLines[1]) {
            lineContainer
                .append("line")
                .attr("stroke", "red")
                .attr("stroke-width", 14)
                .attr("x1", leftPadding - space - 10)
                .attr("y1", topPadding + space * drawLines[1][col])
                .attr("x2", leftPadding + space * 5 + 10)
                .attr("y2", topPadding + space * drawLines[1][col])
                .attr("stroke-opacity", 0.5)
                .attr("stroke-linecap", "round")
        }

        nextBtn.click(() => {
            lineContainer.remove();

            $(".hungarian-container tr:last-child td:nth-child(3)").append(
                $("<button>Reduce</button>").click(event => {
                    minNum = [].reduce.call(rowTr, (r, v) => {
                        let val = $(v[0]).text() * 1;
                        return val < r ? val : r;
                    }, 100);

                    for(let i = 0; i < 6; i++) {
                        let val = $(rowTr[i][0]).text() * 1 - minNum;
                        if (val == 0) {
                            circles[i][0].attr("stroke", "red");
                        }
                        $(rowTr[i][0]).text(val);
                    }
                    $(event.target).remove();
                    Step3();
                }).css("transform", "rotate(90deg)")
                .css("width", "44px")
                .css("padding", "6px 1px")
                .css("font-size", "6px")
            );

            nextBtn.hide();
        }).show();
    }

    const result = [5, 0, 4, 3, 1, 2];

    function Step3() {
        nextBtn.off('click').click(() => {
            nextBtn.hide();
    
            for(let i = 0; i < 6; i++) {
                circles[i][result[i]].attr("stroke", "green");
            }

            $(".hungarian-container #hungarian-result").show();
        })

        nextBtn.show();
    }
})();