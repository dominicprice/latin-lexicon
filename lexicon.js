var maxHistorySize = 15;

// Get the Latin section and attach it to a new div. Not very intuitive, as the page format
// is very linear with very little nesting, and the DOMParser leaves in all comments and newlines as 
// #comment and #text nodes which we need to ignore, but we loop through all the children of the first
// div.mw-parser-output element which contains all the information for the word looking for a h2 tag
// corresponding to the Latin section, and then manage all the sibling nodes until we either come
// to a h2 tag which signifies an new language section, or we reach the end of the div.mw-parser-output. 
function parsePage(root) {
	let res = $("<div>");
	let subsection = $("<div>");
	let inSection = false;
	for (let curNode = root.firstChild; curNode; curNode = curNode.nextSibling) {
		// Ignore comment and text nodes
		if (curNode.nodeName[0] === "#")
			continue;	
		// Continue building tree if in Latin section
		if (inSection) {
			switch (curNode.tagName.toLowerCase()) {
				case "h2":
					// Reached new section, end tree building
					if (subsection.childElementCount > 0)
						res.appendChild(subsection);
					return res;
				case "h3":
					// Start new subsection
					if (subsection.childElementCount > 0) {
						res.appendChild(subsection);
						subsection = $("<div>");
					}
					subsection.appendChild(curNode.cloneNode(true));
					break;
				case "table":
					// Place in a div to make it scrollable
					let container = $("<div>", { "class": "table-hscroll" });
					container.appendChild(curNode.cloneNode(true));
					subsection.appendChild(container);
					break;
				default:
					// Add to current subsection
					subsection.appendChild(curNode.cloneNode(true));
			}
		}
		// Set inSection flag to true if we find the start of the Latin section
		if (curNode.tagName.toLowerCase() === "h2" && curNode.firstChild.innerHTML === "Latin")
			inSection = true;
	}
	if (subsection.childElementCount > 0)
		res.appendChild(subsection);
	return res;
}

// Clean up the extracted DOM
function cleanDOM(root) {
	// 1) Remove all the [edit] tags
	let paras = root.getElementsByClassName('mw-editsection');
	while (paras[0])
		paras[0].parentNode.removeChild(paras[0]);
	// 2) Reassign link locations
	let links = Array.from($$('a', root));
	let  = new RegExp('', 'i');
	for (const link of links) {
		let href = link.getAttribute("href") || "";
		// a) External links and page-scrolls are ok
		if (/^https?:\/\//.test(href) || href[0] === "#")
			continue;
		let match = href.match(/^\/wiki\/(\w+)#Latin$/);
		if (match) {
			// b) Links to another Latin word get replaced with a 
			//    call to search(), and given the 'searchable' class
			//    to differentiate them from external links
			link.setAttribute("href", "javascript:void(0)");
			link.addEventListener("click", function() {
				search(match[1]);
			});
			link.classList.add("searchable");
		}
		else if (href[0] === "/") {
			// c) Other relative links get converted to absolute links
			link.setAttribute("href", "https://en.wiktionary.org/wiki" + href);
		}
		else {
			// c) Any other link we won't handle (yet?) so replace
			//    with a <span> tag and the same text
			let newElem = $("<span>", { "html": link.innerHTML });
			link.parentNode.replaceChild(newElem, link);
		}
	}
}

function displayPage(name, response) {
	// Clear page
	let output = $("#output");
	output.innerHTML = "";
	let searchHistoryDiv = $("#search-history");
	searchHistoryDiv.innerHTML = "";
	let searchHistory = JSON.parse(localStorage.getItem("searchHistory") || "[]");
	for (const elem of searchHistory) {
		$("<a>", { "class": "searchable", "attr:href": "javascript:void(0)", "html": elem, "event:click": search.bind(this, elem), "parent": searchHistoryDiv });
		$("<span>", { "html": ", " , "parent": searchHistoryDiv });
	}
	if (searchHistory.length > 0) {
		$("<a>", { "class": "searchable", "attr:href": "javascript:void(0)", "html": "(clear)", "parent": searchHistoryDiv, "event:click": function() { 
			localStorage.setItem("searchHistory", "[]");
			searchHistoryDiv.innerHTML = "";
		}});
	}
	
	// Get response as JSON and handle errors
	let parser = new DOMParser();
	let root = JSON.parse(response);
	if (root.error) {
		$("<h2>", { "html": `No Latin results matching ${name} were found`, "parent": output });
		return;
	}
	
	// Create DOM tree from the response
	let html = JSON.parse(response)["parse"]["text"]["*"];
	let content = parser.parseFromString(html, "text/html");

	// Create a new DOM tree for the Latin section
	let topNode = parsePage($(".mw-parser-output", content));
	if (topNode.childElementCount === 0) {
		$("<h2>", { "html": `No Latin results matching ${name} were found`, "parent": output });
		return;
	}
	cleanDOM(topNode);

	// Append to the page and scroll to top
	output.appendChild(topNode);
	output.scrollIntoView();
}

function search(searchQuery) {
	let searchHistory = JSON.parse(localStorage.getItem("searchHistory") || "[]")
	let pos = searchHistory.findIndex(x => x == searchQuery);
	if (pos !== -1)
		searchHistory.splice(pos, 1);
	searchHistory.push(searchQuery);
	if (searchHistory.length >= maxHistorySize)
		searchHistory.shift()
	localStorage.setItem("searchHistory", JSON.stringify(searchHistory));
	$get("https://en.wiktionary.org/w/api.php", {
		"action": "parse",
		"format": "json",
		"prop": "text|revid",
		"origin": "*",
		"page": searchQuery
	}, function(response) {
		displayPage(searchQuery, response);
	}, function(response) {
		$("<h2>", { "html": "There was an error with your request", "parent": $("#output") });
		$("<p>", { "html": response, "parent": $("#output") });
	});
};

document.addEventListener("DOMContentLoaded", function() {
	let output = $("#output");
	let search_btn = $("#search-btn");
	let search_input = $("#search");
	
	// Attach search button and enter press to the search function
	search_btn.addEventListener("click", function() { search(search_input.value); });
	search_input.addEventListener("keyup", function(event) {
		if (event.keyCode === 13) {
			event.preventDefault();
			search_btn.click();
		}
	});

	// Visit the last page we were looking at 
	let searchHistory = JSON.parse(localStorage.getItem("searchHistory") || "[]")
	if (searchHistory.length > 0)
		search(searchHistory[searchHistory.length - 1]);
	else
		output.innerHTML = "Use the search bar to find a word";
	
	// Probably doesn't need an explanatory note.
	search_input.focus();
});