const concepts = [
    {
        title: "Revenue",
        description: "Revenue is the total income a company generates from its normal business activities before expenses are deducted."
    },
    {
        title: "Profit",
        description: "Profit is the amount a company keeps after its expenses are deducted from revenue."
    },
    {
        title: "Asset",
        description: "An asset is something a company owns that has economic value."
    },
    {
        title: "Liability",
        description: "A liability is a financial obligation that a company owes to another party."
    },
    {
        title: "Equity",
        description: "Equity represents the ownership value remaining after liabilities are subtracted from assets."
    }
];

let currentConcept = 0;
function showConcept() {
    document.getElementById("concept-title").textContent =
        concepts[currentConcept].title;

    document.getElementById("concept-description").textContent =
        concepts[currentConcept].description;

    document.getElementById("concept-progress").textContent =
        `Concept ${currentConcept + 1} / ${concepts.length}`;
}
document.getElementById("know-btn").addEventListener("click", function () {
    currentConcept++;

    if (currentConcept < concepts.length) {
        showConcept();
    } else {
        alert("Lesson completed!");
        window.location.href = "index.html";
    }
});
document.getElementById("again-btn").addEventListener("click", function () {
    alert("We'll show this concept again later.");
});