function loadResponse(response) {
	// Clear page
	let output = $("#output");
	output.innerHTML = "";
	
	// Get response as JSON and handle errors
	let parser = new DOMParser();
	let root = JSON.parse(response);
	if (root.error) {
		$("<h2>", { "html": `No Latin results matching ${$("#search").value} were found`, "parent": output });
		return;
	}
	
	// Create DOM tree from the response
	let html = JSON.parse(response)["parse"]["text"]["*"];
	let content = parser.parseFromString(html, "text/html");

	// Get the Latin section and attach it to a new node
	let topNode = $("<div>");
	$("<h1>", { "html": $("#search").value, "parent": topNode });
	let recording = false;
	for (curNode = $(".mw-parser-output", content).firstChild; curNode; curNode = curNode.nextSibling) {
		console.log(curNode.nodeName);
		if (curNode.nodeName[0] === "#")
			continue;
		if (curNode.tagName.toLowerCase() === "h2" && recording)
			break;
		if (recording) {
			topNode.appendChild(curNode.cloneNode(true));
		}
		if (curNode.tagName.toLowerCase() === "h2" && curNode.firstChild.innerHTML === "Latin")
			recording = true;
	}
	
	// Handle error if recording == false i.e. there was no Latin section
	if (recording === false) {
		$("<h2>", { "html": `No Latin results matching ${$("#search").value} were found`, "parent": output });
		return;
	}
	
	// Clean up the extracted DOM
	let paras = topNode.getElementsByClassName('mw-editsection');
	while (paras[0])
		paras[0].parentNode.removeChild(paras[0]);
	let links = Array.from($$('a', topNode));
	let  = new RegExp('', 'i');
	for (const link of links) {
		let href = link.getAttribute("href") || "";
		if (/^https?:\/\//.test(href))
			continue;
		let match = href.match(/^\/wiki\/(\w+)#Latin$/);
		if (match) {
			link.setAttribute("href", "javascript:void(0)");
			link.addEventListener("click", function() {
				$("#search").value = match[1];
				search();
			});
		}
		else {
			let newElem = $("<span>", { "html": link.innerHTML });
			link.parentNode.replaceChild(newElem, link);
		}
	}
	
	// Append to the page
	output.appendChild(topNode);
}

function search() {
	let searchQuery = $("#search").value;
	localStorage.setItem("lastRequest", searchQuery);
	$get("https://en.wiktionary.org/w/api.php", {
		"action": "parse",
		"format": "json",
		"prop": "text|revid",
		"origin": "*",
		"page": searchQuery
	}, function(response) {
		loadResponse(response);
	}, function(response) {
		$("<h2>", { "html": "There was an error with your request", "parent": $("#output") });
		$("<p>", { "html": response, "parent": $("#output") });
	});
};


let search_btn = $("#search-btn");

search_btn.addEventListener("click", search);
$("#search").addEventListener("keyup", function(event) {
	if (event.keyCode === 13) {
		event.preventDefault();
		search();
	}
});

document.addEventListener("DOMContentLoaded", function() {
	$("#search").focus();
	let lastRequest = localStorage.getItem("lastRequest");
	if (lastRequest) {
		$("#search").value = lastRequest;
		search();
	}
	else {
		$("#output").innerHTML = "Use the search bar to find a word";
	}
});