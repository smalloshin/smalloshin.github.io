const introductionBtn = $(".introduction-container .count-btn");
let now = new Date().getTime();

(async () => {
    $("#intro-timer").hide();
    let sec = 0,
        ms = 0,
        timer;
    timer = setInterval(() => {
        let timeElapsed = new Date().getTime() - now;
        sec = timeElapsed;
        ms = timeElapsed % 1000;
        $("#intro-timer").text(`${timeElapsed.toString().slice(0,-3)}.${timeElapsed.toString().slice(-3)}s`);
    }, 1);
    introductionBtn.click(() => {
        introductionBtn.text() === "Start" 
        ?
            (
                introductionBtn.text("Submit"),
                $("#intro-timer").show(),
                (now = new Date().getTime()),
                $(".video-frame, .count-table").css("pointer-events", "auto"),
                $(".video-frame")[0].play(),
                $(".video-frame")[0].controls = true,
                $("#description").text("Press the button to submit your answer.")
            )
            : 
            (($(".introduction-container .count-ans input")
                .prop("readonly", true)
                .each((i, el) => {
                    el = $(el);
                    el.css(
                        {
                            "color":
                            el.val() == el.data("ans")
                                ? "green"
                                : el.val() < el.data("ans")
                                ? "red"
                                : "purple",
                            "font-weight":
                            el.val() != el.data("ans") 
                                ?  "bold"
                                : "normal"
                        }
                        
                    );
                    el.val(el.data("ans"))
                })),
                introductionBtn.hide(),
                clearInterval(timer),
                $(".video-frame")[0].pause(),
                $(".video-frame")[0].controls = false,
                $("#intro-timer").text("You use "+$("#intro-timer").text())
            );
    });
})();