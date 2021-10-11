function pushToFavourites(item) {
	let favourites = viewFavourites();
	let pos = favourites.findIndex(x => x == item);
	if (pos == -1)
		favourites.push(item);
	favourites.sort();
	localStorage.setItem("favourites", JSON.stringify(favourites));
	refreshFavourites();
}

function hasInFavourites(item) {
	let favourites = viewFavourites();
	return favourites.indexOf(item) !== -1;
}

function viewFavourites() {
	let favourites = JSON.parse(localStorage.getItem("favourites") || "[]");
	return favourites;
}

function removeFromFavourites(name) {
	let favourites = viewFavourites();
	let idx = favourites.indexOf(name);
	if (idx !== -1) {
		favourites.splice(idx, 1);
		localStorage.setItem("favourites", JSON.stringify(favourites));
	}
	refreshFavourites();
}

function clearFavourites() {
	localStorage.setItem("favourites", "[]");
	refreshFavourites();
	for (const elem of $$(".toggle-favourite")) {
		elem.innerHTML = "☆";
	}
}

function refreshFavourites() {
	let favourites = $("#favourites");
	favourites.innerHTML = "";
	for (const fav of viewFavourites()) {
		$("<a>", { "class": "searchable", "attr:href": "javascript:void(0)", "html": fav, "event:click": searchEntry.bind(this, fav), "parent": favourites });
		$("<span>", { "html": " | " , "parent": favourites });
	}
	if (favourites.childElementCount !== 0) {
		$("<a>", { "class": "searchable", "attr:href": "javascript:void(0)", "html": "(clear)", "parent": favourites, "event:click": function() { 
			clearFavourites();
			refreshFavourites();
		}});
	}
}

// Get the Latin section and attach it to a new div. Not very intuitive, as the page format
// is very linear with very little nesting, and the DOMParser leaves in all comments and newlines as 
// #comment and #text nodes which we need to ignore, but we loop through all the children of the first
// div.mw-parser-output element which contains all the information for the word looking for a h2 tag
// corresponding to the Latin section, and then manage all the sibling nodes until we either come
// to a h2 tag which signifies an new language section, or we reach the end of the div.mw-parser-output. 
function parseEntry(root) {
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
					return res;
				case "h3":
				case "h4":
					// Start new subsection
					subsection = $("<div>");
					let header = $("<h3>", { "html": curNode.innerHTML });
					let associatedSection = subsection;
					header.addEventListener("click", function() {
						associatedSection.classList.toggle("hidden");
					});
					res.appendChild(header);
					res.appendChild(subsection);
				case "hr":
					// Ignore horizontal rules, we make our own where we want them
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
	return res;
}

// Clean up the extracted DOM
function cleanEntry(root) {
	// 1) Remove all the [edit] tags
	let paras = root.getElementsByClassName('mw-editsection');
	while (paras[0])
		paras[0].parentNode.removeChild(paras[0]);
	let elems = $$("sup > span > a", root, true);
	for (const a of elems) {
		if (a.innerHTML === "edit") {
			let sup = a.parentNode.parentNode;
			sup.parentNode.removeChild(sup);
		}
	}
	
	// 2) Put tables inside table-hscroll divs
	let tables = $$("table", root, true);
	for (const table of tables) {
		let container = $("<div>", { "class": "table-hscroll" });
		container.appendChild(table.cloneNode(true));
		table.parentNode.replaceChild(container, table);
	}
	
	// 3) Restyle inflection tables: iterate over rows and change background color of cells. Replace
	//    line breaks with commas. Move the vocative + accusative case next to the nominative case.
	for (const table of $$(".inflection-table", root)) {
		let nominative = null, vocative = null, accusative = null;
		for (const tr of $$("tr", table)) {
			for (const td of $$("td, th", tr)) {
				// Replace linebreaks with commas
				for (const br of $$("br", td, true))
					br.parentNode.replaceChild($("<span>", { "html": ", " }), br);
				// Change the gaudy background colours
				if (td.style.background === "rgb(84, 158, 160)")
					td.style.background = "#aaa";
				else if (td.style.background === "rgb(64, 224, 208)")
					td.style.background = "#ccc";
				// Check if this is the nominative/accusative rows
				if (td.childElementCount === 1) {
					if (td.firstChild.title === "nominative case")
						nominative = tr;
					else if (td.firstChild.title === "vocative case")
						vocative = tr;
					else if (td.firstChild.title === "accusative case")
						accusative = tr;
				}
			}
		}
		// If we found nominative and accusative, move acc next to nom.
		if (nominative !== null) {
			if (accusative !== null)
				nominative.parentNode.insertBefore(accusative, nominative.nextSibling);
			if (vocative !== null)
				nominative.parentNode.insertBefore(vocative, nominative.nextSibling);
		}
	}
	
	// 3) Reassign link locations
	let links = $$('a', root, true);
	for (const link of links) {
		let href = link.getAttribute("href") || "";
		let match;
		if (/^https?:\/\//.test(href)) {
			// external links get opened in a new tab
			link.setAttribute("target", "_blank");
			link.classList.add("external");
		}
		else if (match = href.match(/^\/wiki\/(\w+)#Latin$/)) {
			// links to another Latin word get replaced with a 
			// call to search(), and given the 'searchable' class
			// to differentiate them from external links
			link.setAttribute("href", "javascript:void(0)");
			link.addEventListener("click", function() {
				searchEntry(match[1]);
			});
			link.classList.add("searchable");
		}
		else if (match = href.match(/^\/wiki\/Appendix:(.*)$/)) {
			// appendix articles come up as a modal window
			link.setAttribute("href", "javascript:void(0)");
			link.classList.add("information");
			link.addEventListener("click", function() {
				let query = match[1].replace(/_/g, " ");
				searchAppendix(query);
			});
		}
		else if (href[0] === "/") {
			// c) Other relative links get converted to absolute links
			link.setAttribute("href", "https://en.wiktionary.org" + href);
			link.setAttribute("target", "_blank");
			link.classList.add("external");
		}
		else if (href[0] === "#" || href === "javascript:void(0)") {
			// ignore empty links
		}
		else {
			// any other link we won't handle (yet?) so replace
			// with a <span> tag and the same text
			let newElem = $("<span>", { "html": link.innerHTML });
			link.parentNode.replaceChild(newElem, link);
		}
	}
}

function displayEntry(name, response) {
	// Clear page
	let output = $("#output");
	output.innerHTML = "";

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
	let topNode = parseEntry($(".mw-parser-output", content));
	if (topNode.childElementCount === 0) {
		$("<h2>", { "html": `No Latin results matching ${name} were found`, "parent": output });
		return;
	}
	cleanEntry(topNode);
	let nameHeader = $("<h1>", { "html": name });
	let toggleFavourite = $("<small>", { 
		"class": "toggle-favourite", 
		"html": hasInFavourites(name) ? "★" : "☆",
		"event:click": function() {
			if (hasInFavourites(name)) {
				toggleFavourite.innerHTML = "☆"
				removeFromFavourites(name);
			}
			else {
				toggleFavourite.innerHTML = "★"
				pushToFavourites(name);
			}
		},
		"parent": nameHeader 
	});

	// Append to the page and scroll to top
	output.appendChild(nameHeader);
	output.appendChild(topNode);
	output.scrollIntoView();
	$("#search").blur();
}

function hideModal()
{
	$("body").style.overflow = "auto";
	$("#modal-background").style.display = "none";
}

function cleanAppendix(root) {
	// 1) Remove all the [edit] tags
	let paras = root.getElementsByClassName('mw-editsection');
	while (paras[0])
		paras[0].parentNode.removeChild(paras[0]);
	let elems = $$("sup > span > a", root, true);
	for (const a of elems) {
		if (a.innerHTML === "edit") {
			let sup = a.parentNode.parentNode;
			sup.parentNode.removeChild(sup);
		}
	}
	
	// Put tables in table-hscroll divs
	let tables = $$("table", root, true);
	for (const table of tables) {
		let container = $("<div>", { "class": "table-hscroll" });
		container.appendChild(table.cloneNode(true));
		table.parentNode.replaceChild(container, table);
	}
	
	// set external links to open in an external window and change
	// style of link jumps
	let links = $$("a", root, true);
	for (const link of links) {
		let href = link.getAttribute("href");
		if (href === null) {
			continue;
		}
		else if (href[0] === "#") {
			link.classList.add("information");
		}
		else if (href[0] === "/") {
			link.setAttribute("href", "https://en.wiktionary.org" + href);
			link.setAttribute("target", "_blank");
			link.classList.add("external");
		}
		else {
			link.setAttribute("target", "_blank");
			link.classList.add("external");
		}
	}
}

function displayAppendix(name, response) {
	// Clear page
	let modal = $("#modal-background");
	modal.style.display = "block";
	$("body").style.overflow = "hidden";
	let main = $("#modal-main");
	main.innerHTML = "";
	$("#modal-title").innerHTML = name;
	
	// Get response as JSON and handle errors
	let parser = new DOMParser();
	let root = JSON.parse(response);
	if (root.error) {
		$("<h2>", { "html": `No appendix results matching ${name} were found`, "parent": main });
		return;
	}
	
	let html = JSON.parse(response)["parse"]["text"]["*"];
	let content = parser.parseFromString(html, "text/html");
	let topNode = $(".mw-parser-output", content)
	cleanAppendix(topNode);
	main.appendChild(topNode);
}

function searchEntry(searchQuery) {
	localStorage.setItem("lastWord", searchQuery);
	$get("https://en.wiktionary.org/w/api.php", {
		"action": "parse",
		"format": "json",
		"prop": "text|revid",
		"origin": "*",
		"page": searchQuery
	}, function(response) {
		displayEntry(searchQuery, response);
	}, function(response) {
		$("<h2>", { "html": "There was an error with your request", "parent": $("#output") });
		$("<p>", { "html": response, "parent": $("#output") });
	});
};

function searchAppendix(searchQuery) {
	$get("https://en.wiktionary.org/w/api.php", {
		"action": "parse",
		"format": "json",
		"prop": "text|revid",
		"origin": "*",
		"page": "Appendix:" + searchQuery
	}, function(response) {
		displayAppendix(searchQuery, response);
	}, function(response) {
		let modal = $("#modal");
		modal.style.display = 'block';
		let main = $("#modal-main");
		main.innerHTML = "";
		let div = $("<p>", { "html": "There was an error with your request", "parent": main });
	});
}

document.addEventListener("DOMContentLoaded", function() {
	let output = $("#output");
	let search_btn = $("#search-btn");
	let search_input = $("#search");
	
	// Attach search button and enter press to the search function
	search_btn.addEventListener("click", function() { searchEntry(search_input.value); });
	search_input.addEventListener("keyup", function(event) {
		if (event.keyCode === 13) {
			event.preventDefault();
			search_btn.click();
		}
	});

	refreshFavourites();

	// Visit the last page we were looking at 
	let lastWord = localStorage.getItem("lastWord");
	if (lastWord !== null)
		searchEntry(lastWord);
	else
		output.innerHTML = "Use the search bar to find a word";
	
	// Probably doesn't need an explanatory note.
	search_input.focus();
});