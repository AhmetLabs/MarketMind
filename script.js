const masteredConcepts = 36;
const totalConcepts = 50;

const progressPercentage = (masteredConcepts / totalConcepts) * 100;

document.getElementById("progress-text").textContent =
    `${masteredConcepts} / ${totalConcepts} concepts mastered`;

document.getElementById("progress-fill").style.width =
    `${progressPercentage}%`;
    document.getElementById("start-lesson-btn").addEventListener("click", function () {
    window.location.href = "lesson.html";
});