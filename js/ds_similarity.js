(() => {
    const dssCompareItems = $(".dss-compare .compare-items");
    const startBtn = $(".dss-demo-start");

    let started = false;
    let startTime, endTime;

    startBtn.click(() => {
        if (started) {
            endTime = new Date().getTime();
            let timeUsed = ((endTime - startTime) / 1000).toFixed(1);

            dssCompareItems.find("p").show();
            startBtn.hide();
            dssCompareItems.find("input").attr("readonly", true);

            $("#dss-demo-time1").text(timeUsed);
            $("#dss-demo-time2").text(((timeUsed / 0.3) * 100) | 0);

            $(".dss-similarity-score").show();
        } else {
            started = true;
            dssCompareItems.find("input").attr("readonly", false);
            startTime = new Date().getTime();
        }
    });
})();
