;var imgLoader = {};
(function() {
	var loadingCount = 0;
	imgLoader.images = {};
	// ロードした画像を2のべき乗サイズに揃える
	var createTexture = function(name, img, func) {
		var size = 1;
		while(img.width > size || img.height > size) {
			size *= 2;
		}
		// canvas 2Dを作成し、そのサイズに拡大縮小する
		var canvas = document.createElement("canvas");
		canvas.width = canvas.height = size;
		canvas.getContext("2d").drawImage(img, 0, 0, img.width, img.height, 0, 0, size, size);
		// canvasを保存してcallbackを呼び出す
		loadingCount--;
		imgLoader.images[name] = canvas;
		func(canvas);
	};
	// 画像をロードする
	imgLoader.load = function(url, func) {
		// 既にあれば何もしない
		if(imgLoader.images[url]) {
			return;
		}
		// 読み込もうとしているフラグを設定
		imgLoader.images[url] = true;
		loadingCount++;
		var img = document.createElement("img");
		img.onload = function() {
			createTexture(url, img, func);
		};
		img.src = url;
	};
	imgLoader.isLoading = function() {
		return loadingCount != 0;
	};
})();
