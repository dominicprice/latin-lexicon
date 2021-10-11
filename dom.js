// lib.js: Minimal javascript general library, Copyright (C) Dominic Price 2020 under the MIT Licence

// Get a reference to a single element
// $(selectors, parent): Get the first matching element which matches selectors, starting 
//                       the search at parent (defaults to document)
//                       e.g. $(".header h1")
// $(tag, opts): Create an element and configure it with opts.
//               e.g. $("<div>", { "class": "big", "parent": myelem })
function $(selectors, opts) {
	if (selectors[0] === "<" && selectors[selectors.length-1] === ">") {
		let elem = document.createElement(selectors.slice(1, selectors.length - 1));
		if (opts === undefined)
			return elem;
		for (const [key, val] of Object.entries(opts)) {
			if (key === "class") {
				let classes = val.split(" ")
				for (let i = 0; i < classes.length; ++i)
					elem.classList.add(classes[i]);
			}
			else if (key === "html")
				elem.innerHTML = val;
			else if (key === "id")
				elem.id = val;
			else if (key.startsWith("event:"))
				elem.addEventListener(key.slice(6), val);
			else if (key === "style")
				elem.style.cssText = val;
			else if (key.startsWith("style:"))
				elem.style[((name)=>name[0] + name.split("-").map(x=>x[0].toUpperCase()+x.slice(1)).join("").slice(1))(key.slice(6))] = val;
			else if (key === "parent") 
				val.appendChild(elem);
			else if (key.startsWith("attr:"))
				elem.setAttribute(key.slice(5), val);
			else
				console.warn(`Unknown option ${key} passed to constructor of ${selectors} element`);
		}
		return elem;
	}
	else {
		return opts === undefined ? document.querySelector(selectors) : opts.querySelector(selectors);
	}
}

// Get a NodeList of all elements matching a selector, starting the search at parent (defaults to document)
function $$(selectors, par = document, asArray = false) {
	let list = par.querySelectorAll(selectors);
	if (asArray)
		return Array.from(list);
	else;
		return list;
}

class $TabGroup {
	constructor(activeClass = "active") {
		this.tabs = [];
	}
	
	appendTab(name, elem) {
		if (elem === undefined)
			elem = $("<div>");
		let btn = $("<button>", {
			"event:click": function() {
				for (const tab of this.tabs) {
					tab.btn.classList.remove(activeClass);
					tab.elem.style.display = "none";
				}
				elem.style.display = "block";
				btn.classList.add("active");
			}
		});
		this.tabs.push({ "elem": elem, "btn": btn });
		return elem;
	}
	
	findTab(name) {
		if (typeof name === 'string' || name instanceof String) {
			for (let i = 0; i < this.tabs.length; ++i) {
				if (this.tabs[i].btn.innerHTML === name)
					return i;
			}
			return -1;
		}
		return name;
	}
	
	getTab(name) {
		name = findTab(name);
		if (name === -1)
			return null;
		return this.tabs[name].elem;
	}
	
	removeTab(name) {
		if (name === undefined) {
			name = this.tabs.length - 1;
		}
		else {
			name = this.findTab(name);
			if (name === -1)
				return false;
		}
		this.tabs.splice(name, 1);
		return true;
	}
	
	drawButtons(elem) {
		if (elem === undefined)
			elem = $("<div>");
		else
			elem.innerHTML = "";
		for (const tab of this.tabs)
			elem.appendChild(tab.btn);
		return elem;
	}
	
	drawTabs(elem) {
		if (elem === undefined)
			elem = $("<div>");
		else
			elem.innerHTML = "";
		for (const tab of this.tabs)
			elem.appendChild(tab.elem);
		return elem;
	}
}

function $applyPatch(patchName) {
	let re = new RegExp(`^${patchName}(\.|$)`);
	let simpleCompare = function(a, b) { 
		if (a < b)
			return 1;
		return a > b ? -1 : 0;
	};
	let patched = false;
	let monkeyPatch = function(obj, name, def) {
		Object.defineProperty(obj.prototype, name, { "value": def });
		patched = true;
	}
	if (re.test("array.binSearch")) {
		monkeyPatch(Array, "binSearch", function(val, compareFunction=simpleCompare) {
			let m = 0, n = this.length - 1;
			while (m <= n) {
				let k = (n + m) >> 1;
				let cmp = compareFunction(this[k], val);
				if (cmp > 0)
					m = k + 1;
				else if (cmp < 0)
					n = k - 1;
				else
					return k;
			}
			return -m;
		});
	}
	if (re.test("array.swap")) {
		monkeyPatch(Array, "swap", function(i, j) {
			if (i !== j) {
				let tmp = this[i];
				this[i] = this[j];
				this[j] = tmp;
			}
		});
	}
	if (re.test("array.nextPermutation")) {
		monkeyPatch(Array, "nextPermutation",  function(compareFunction=simpleCompare) {
			let first = 0, last = this.length;
			if (first == last) return false;
			let i = last;
			if (first == --i) return false;
			
			while (true) {
				let i1 = i;
				if (compareFunction(this[--i], this[i1]) > 0) {
					let i2 = last;
					while (compareFunction(this[i], this[--i2]) <= 0);
					[ this[i], this[i2] ] = [ this[i2], this[i] ]
					let n = Math.floor((last - i1) / 2);
					for (let j = 0; j < n; ++j)
						[ this[i1+j], this[last-1-j] ] = [ this[last-1-j], this[i1+j] ]
					return true;
				}
				if (i == first) {
					this.reverse();
					return false;
				}
			}
		});
	}
	if (re.test("array.uniquify")) {
		monkeyPatch(Array, "uniquify", function() {
			for (let i = this.length - 1;  i >= 1; --i) {
				if (this[i-1] === this[i])
					this.splice(i-1, 1);
				
			}
		});
	}
	if (re.test("date.format")) {
		monkeyPatch(Date, "format", function(format, utc) {
			var MMMM = ["\x00", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
			var MMM = ["\x01", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
			var dddd = ["\x02", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
			var ddd = ["\x03", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

			function ii(i, len) {
				var s = i + "";
				len = len || 2;
				while (s.length < len) s = "0" + s;
				return s;
			}

			var y = utc ? date.getUTCFullYear() : date.getFullYear();
			format = format.replace(/(^|[^\\])yyyy+/g, "$1" + y);
			format = format.replace(/(^|[^\\])yy/g, "$1" + y.toString().substr(2, 2));
			format = format.replace(/(^|[^\\])y/g, "$1" + y);

			var M = (utc ? date.getUTCMonth() : date.getMonth()) + 1;
			format = format.replace(/(^|[^\\])MMMM+/g, "$1" + MMMM[0]);
			format = format.replace(/(^|[^\\])MMM/g, "$1" + MMM[0]);
			format = format.replace(/(^|[^\\])MM/g, "$1" + ii(M));
			format = format.replace(/(^|[^\\])M/g, "$1" + M);

			var d = utc ? date.getUTCDate() : date.getDate();
			format = format.replace(/(^|[^\\])dddd+/g, "$1" + dddd[0]);
			format = format.replace(/(^|[^\\])ddd/g, "$1" + ddd[0]);
			format = format.replace(/(^|[^\\])dd/g, "$1" + ii(d));
			format = format.replace(/(^|[^\\])d/g, "$1" + d);

			var H = utc ? date.getUTCHours() : date.getHours();
			format = format.replace(/(^|[^\\])HH+/g, "$1" + ii(H));
			format = format.replace(/(^|[^\\])H/g, "$1" + H);

			var h = H > 12 ? H - 12 : H == 0 ? 12 : H;
			format = format.replace(/(^|[^\\])hh+/g, "$1" + ii(h));
			format = format.replace(/(^|[^\\])h/g, "$1" + h);

			var m = utc ? date.getUTCMinutes() : date.getMinutes();
			format = format.replace(/(^|[^\\])mm+/g, "$1" + ii(m));
			format = format.replace(/(^|[^\\])m/g, "$1" + m);

			var s = utc ? date.getUTCSeconds() : date.getSeconds();
			format = format.replace(/(^|[^\\])ss+/g, "$1" + ii(s));
			format = format.replace(/(^|[^\\])s/g, "$1" + s);

			var f = utc ? date.getUTCMilliseconds() : date.getMilliseconds();
			format = format.replace(/(^|[^\\])fff+/g, "$1" + ii(f, 3));
			f = Math.round(f / 10);
			format = format.replace(/(^|[^\\])ff/g, "$1" + ii(f));
			f = Math.round(f / 10);
			format = format.replace(/(^|[^\\])f/g, "$1" + f);

			var T = H < 12 ? "AM" : "PM";
			format = format.replace(/(^|[^\\])TT+/g, "$1" + T);
			format = format.replace(/(^|[^\\])T/g, "$1" + T.charAt(0));

			var t = T.toLowerCase();
			format = format.replace(/(^|[^\\])tt+/g, "$1" + t);
			format = format.replace(/(^|[^\\])t/g, "$1" + t.charAt(0));

			var tz = -date.getTimezoneOffset();
			var K = utc || !tz ? "Z" : tz > 0 ? "+" : "-";
			if (!utc) {
				tz = Math.abs(tz);
				var tzHrs = Math.floor(tz / 60);
				var tzMin = tz % 60;
				K += ii(tzHrs) + ":" + ii(tzMin);
			}
			format = format.replace(/(^|[^\\])K/g, "$1" + K);

			var day = (utc ? date.getUTCDay() : date.getDay()) + 1;
			format = format.replace(new RegExp(dddd[0], "g"), dddd[day]);
			format = format.replace(new RegExp(ddd[0], "g"), ddd[day]);

			format = format.replace(new RegExp(MMMM[0], "g"), MMMM[M]);
			format = format.replace(new RegExp(MMM[0], "g"), MMM[M]);

			format = format.replace(/\\(.)/g, "$1");

			return format;
			});
		}
		if (re.test("string.mutate")) {
			monkeyPatch(String, "mutate", function(fn) {
				return fn([...this]).join("");
			});
		}
		if (!patched)
			console.warn(`No patches matching ${patchName} found`);
}

function $param(obj) {
	let s = ""
	for (const [key, value] of Object.entries(obj))
		s = `${s}&${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
	return s.substr(1).replace(/%20/g, "+");
	
}

function $setCookie(name, value, exdays) {
	const d = new Date();
	d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
	let expires = "expires="+ d.toUTCString();
	document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

function $getCookie(name) {
	name = name + "=";
	let decodedCookie = decodeURIComponent(document.cookie);
	let ca = decodedCookie.split(';');
	for (let i = 0; i < ca.length; i++) {
		let c = ca[i];
		while (c.charAt(0) == ' ')
			c = c.substring(1);
		if (c.indexOf(name) == 0) 
			return c.substring(name.length, c.length);
	}
	return "";
}

function $get(endpoint, payload, success, failure) {
	const xhr = new XMLHttpRequest();
	let payloadString = $param(payload);
	if (payloadString !== "")
		endpoint = endpoint + "?" + payloadString;
	xhr.open('GET', endpoint, true);
	xhr.onreadystatechange = function() {
		if (xhr.readyState === XMLHttpRequest.DONE) {
			let status = xhr.status;
			if (status === 0 || (status >= 200 && status < 400))
				success(xhr.responseText, status);
			else if (failure)
				failure(xhr.responseText, status);
		}
	}
	xhr.send(null);
}

function $post(endpoint, payload, success, failure) {
	const xhr = new XMLHttpRequest();
	xhr.open('POST', endpoint, true);
	xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded")
	xhr.onreadystatechange = function() {
		if (xhr.readyState === XMLHttpRequest.DONE) {
			let status = xhr.status;
			if (status === 0 || (status >= 200 && status < 400))
				success(xhr.responseText, status);
			else
				failure(xhr.responseText, status);
		}
	}
	xhr.send($param(payload));
}

function ready(fn) {
    // see if DOM is already available
    if (document.readyState === "complete" || document.readyState === "interactive") {
        // call on next available tick
        setTimeout(fn, 1);
    } else {
        document.addEventListener("DOMContentLoaded", fn);
    }
} 