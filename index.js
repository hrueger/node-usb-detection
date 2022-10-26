// var SegfaultHandler = require('segfault-handler');
// SegfaultHandler.registerHandler();

var index = require('./package.json');
const path = require('path');
const fs = require('fs');

function isFunction(functionToCheck) {
	return typeof functionToCheck === 'function';
}

if(global[index.name] && global[index.name].version === index.version) {
	module.exports = global[index.name];
} else {
	const prebuildFilename = `detection-${process.platform}-${process.arch}.node`;
	const prebuildPath = path.join(__dirname, 'prebuilds', prebuildFilename);
	let binding;
	if(fs.existsSync(prebuildPath)) {
		binding = require(prebuildPath);
	} else {
		binding = require('bindings')('detection.node');
	}
	var EventEmitter2 = require('eventemitter2').EventEmitter2;

	var detection = binding.Detection ? new binding.Detection() : binding;

	var detector = new EventEmitter2({
		wildcard: true,
		delimiter: ':',
		maxListeners: 1000 // default would be 10!
	});

	//detector.find = detection.find;
	detector.find = function(vid, pid, callback) {
		// Suss out the optional parameters
		if(isFunction(vid) && !pid && !callback) {
			callback = vid;
			vid = undefined;
		} else if(isFunction(pid) && !callback) {
			callback = pid;
			pid = undefined;
		}

		return new Promise(function(resolve, reject) {
			// Assemble the optional args into something we can use with `apply`
			var args = [];
			if(vid) {
				args.push(vid);
			}
			if(pid) {
				args.push(pid);
			}

			// Fire off the `find` function that actually does all of the work
			const devices = detection.findDevices.apply(detection, args);
			
			// We call the callback if they passed one
			if(callback) {
				callback.call(callback, undefined, devices);
			}

			resolve(devices)
		});
	};

	function fireAdded(device) {
		detector.emit('add:' + device.vendorId + ':' + device.productId, device);
		detector.emit('insert:' + device.vendorId + ':' + device.productId, device);
		detector.emit('add:' + device.vendorId, device);
		detector.emit('insert:' + device.vendorId, device);
		detector.emit('add', device);
		detector.emit('insert', device);

		detector.emit('change:' + device.vendorId + ':' + device.productId, device);
		detector.emit('change:' + device.vendorId, device);
		detector.emit('change', device);
	}

	function fireRemoved(device) {
		detector.emit('remove:' + device.vendorId + ':' + device.productId, device);
		detector.emit('remove:' + device.vendorId, device);
		detector.emit('remove', device);

		detector.emit('change:' + device.vendorId + ':' + device.productId, device);
		detector.emit('change:' + device.vendorId, device);
		detector.emit('change', device);
	}

	function fireEvent(type, device) {
		switch (type) {
		case 'add':
			fireAdded(device);
			break;
		case 'remove':
			fireRemoved(device);
			break;
		default:
			// Ignore
			break;
		}
	}

	detector.isMonitoring = function() {
		return detection.isMonitoring();
	};

	detector.startMonitoring = function() {
		detection.startMonitoring(fireEvent);
	};

	detector.stopMonitoring = function() {
		detection.stopMonitoring();
	};

	detector.version = index.version;
	global[index.name] = detector;

	module.exports = detector;
}
