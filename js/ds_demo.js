(() => {
    const Questions = [
        {
            target: "data/deepsort/stage (8)/target.jpg",
            compare: [
                "data/deepsort/stage (8)/1.jpg",
                "data/deepsort/stage (8)/right_answer.jpg",
                "data/deepsort/stage (8)/2.jpg",
                "data/deepsort/stage (8)/3.jpg",
                "data/deepsort/stage (8)/4.jpg",
                "data/deepsort/stage (8)/5.jpg",
            ],
            answer: 1,
        },
        {
            target: "data/deepsort/stage (1)/target.jpg",
            compare: [
                "data/deepsort/stage (1)/1.jpg",
                "data/deepsort/stage (1)/2.jpg",
                "data/deepsort/stage (1)/3.jpg",
                "data/deepsort/stage (1)/right_answer.jpg",
                "data/deepsort/stage (1)/4.jpg",
                "data/deepsort/stage (1)/5.jpg",
            ],
            answer: 3,
        },
        {
            target: "data/deepsort/stage (2)/target.jpg",
            compare: [
                "data/deepsort/stage (2)/1.jpg",
                "data/deepsort/stage (2)/right_answer.jpg",
                "data/deepsort/stage (2)/2.jpg",
                "data/deepsort/stage (2)/3.jpg",
                "data/deepsort/stage (2)/4.jpg",
                "data/deepsort/stage (2)/5.jpg",
            ],
            answer: 1,
        },
        {
            target: "data/deepsort/stage (3)/target.jpg",
            compare: [
                "data/deepsort/stage (3)/1.jpg",
                "data/deepsort/stage (3)/2.jpg",
                "data/deepsort/stage (3)/3.jpg",
                "data/deepsort/stage (3)/4.jpg",
                "data/deepsort/stage (3)/right_answer.jpg",
                "data/deepsort/stage (3)/5.jpg",
            ],
            answer: 4,
        },
        {
            target: "data/deepsort/stage (4)/target.jpg",
            compare: [
                "data/deepsort/stage (4)/right_answer.jpg",
                "data/deepsort/stage (4)/1.jpg",
                "data/deepsort/stage (4)/2.jpg",
                "data/deepsort/stage (4)/3.jpg",
                "data/deepsort/stage (4)/4.jpg",
                "data/deepsort/stage (4)/5.jpg",
            ],
            answer: 0,
        },
        {
            target: "data/deepsort/stage (5)/target.jpg",
            compare: [
                "data/deepsort/stage (5)/1.jpg",
                "data/deepsort/stage (5)/2.jpg",
                "data/deepsort/stage (5)/right_answer.jpg",
                "data/deepsort/stage (5)/3.jpg",
                "data/deepsort/stage (5)/4.jpg",
                "data/deepsort/stage (5)/5.jpg",
            ],
            answer: 2,
        },
        {
            target: "data/deepsort/stage (6)/target.jpg",
            compare: [
                "data/deepsort/stage (6)/1.jpg",
                "data/deepsort/stage (6)/right_answer.jpg",
                "data/deepsort/stage (6)/2.jpg",
                "data/deepsort/stage (6)/3.jpg",
                "data/deepsort/stage (6)/4.jpg",
                "data/deepsort/stage (6)/5.jpg",
            ],
            answer: 1,
        },
        {
            target: "data/deepsort/stage (7)/target.jpg",
            compare: [
                "data/deepsort/stage (7)/1.jpg",
                "data/deepsort/stage (7)/2.jpg",
                "data/deepsort/stage (7)/3.jpg",
                "data/deepsort/stage (7)/4.jpg",
                "data/deepsort/stage (7)/5.jpg",
                "data/deepsort/stage (7)/right_answer.jpg",
            ],
            answer: 5,
        },
        {
            target: "data/deepsort/stage (8)/target.jpg",
            compare: [
                "data/deepsort/stage (8)/1.jpg",
                "data/deepsort/stage (8)/2.jpg",
                "data/deepsort/stage (8)/3.jpg",
                "data/deepsort/stage (8)/right_answer.jpg",
                "data/deepsort/stage (8)/4.jpg",
                "data/deepsort/stage (8)/5.jpg",
            ],
            answer: 3,
        },
        {
            target: "data/deepsort/stage (9)/target.jpg",
            compare: [
                "data/deepsort/stage (9)/1.jpg",
                "data/deepsort/stage (9)/right_answer.jpg",
                "data/deepsort/stage (9)/2.jpg",
                "data/deepsort/stage (9)/3.jpg",
                "data/deepsort/stage (9)/4.jpg",
                "data/deepsort/stage (9)/5.jpg",
            ],
            answer: 2,
        },
        {
            target: "data/deepsort/stage (10)/target.jpg",
            compare: [
                "data/deepsort/stage (10)/1.jpg",
                "data/deepsort/stage (10)/2.jpg",
                "data/deepsort/stage (10)/3.jpg",
                "data/deepsort/stage (10)/right_answer.jpg",
                "data/deepsort/stage (10)/4.jpg",
                "data/deepsort/stage (10)/5.jpg",
            ],
            answer: 3,
        },
    ];

    const targetImage = $(".ds-target img");
    const compareImages = $(".compare-items img");
    const compareCheckbox = $(".compare-items input");
    const nextButton = $(".demo-next");
    const scoreContainer = $(".ds-demo-score");
    const acc1 = $("#ds-demo-acc1");
    const acc2 = $("#ds-demo-acc2");
    const time1 = $("#ds-demo-time1");
    const time2 = $("#ds-demo-time2");
    const isBetter = $("#ds-demo-is-better");

    let questionIndex = 0;
    let score = 0;
    let answerShowed = true;
    let startTime, endTime;

    function showAnswer() {
        let isCorrect = false;
        let isAnswered = false;
        for (let i = 0; i < 6; i++) {
            if (compareCheckbox[i].checked) {
                isAnswered = true;
                break;
            }
        }
        if (!isAnswered) return;
        for (let i = 0; i < 6; i++) {
            if (i == Questions[questionIndex].answer) {
                isCorrect = compareCheckbox[i].checked;
                compareCheckbox[i].checked = true;
                $(compareCheckbox[i]).addClass("correct");
            } else if (compareCheckbox[i].checked) {
                $(compareCheckbox[i]).addClass("wrong");
            }
        }

        if (isCorrect) score++;
        answerShowed = true;
        if (questionIndex) nextButton.text("Next");
        nextButton.text("Next");
        questionIndex++;

        return isCorrect;
    }

    function loadQuestion() {
        compareCheckbox.removeClass("correct");
        compareCheckbox.removeClass("wrong");
        compareCheckbox.prop("checked", false);

        targetImage.attr("src", Questions[questionIndex].target);
        for (let i = 0; i < 6; i++) {
            compareImages[i].src = Questions[questionIndex].compare[i];
        }

        answerShowed = false;

        if (questionIndex) nextButton.text("Done");
        else startTime = new Date().getTime();
        nextButton.text("Done");
    }

    compareCheckbox.click((event) => {
        if (answerShowed) return false;
        compareCheckbox.each((_, checkbox) => {
            if (checkbox != event.target) {
                checkbox.checked = false;
            }
        });
    });

    nextButton.click(() => {
        if (answerShowed) {
            loadQuestion();
        } else {
            showAnswer();
            if (questionIndex >= Questions.length) {
                endTime = new Date().getTime();
                acc1.text(score);
                acc2.text(score * 10);
                if (score < 10) isBetter.text(" (Better)");

                let timeUsed = ((endTime - startTime) / 1000).toFixed(1);
                time1.text(timeUsed);
                time2.text(((timeUsed / 0.7) * 100) | 0);

                scoreContainer.show();
                nextButton.hide();
            }
        }
        
    });

    loadQuestion();
    // showAnswer();
})();
