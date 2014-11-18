;(function() {
	window.onload = function() {
		initialize();
	};
	
	var gl; // WebGLのcontext
	var prog; // コンパイル・リンクされたプログラム
	var initialize = function() {
		// WebGLのcontextを取得
		var canvas = document.getElementById("canvas");
		gl = canvas.getContext("experimental-webgl") || canvas.getContext("webgl");
		if(!gl) {
			document.write("This browser does not support webgl");
			return;
		}
		
		// Vertex Shaderをコンパイル
		var vs = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(vs, document.getElementById("vs").text);
		gl.compileShader(vs);
		if(!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
			console.log("vertex shader compile error");
			console.log(gl.getShaderInfoLog(vs));
			return;
		}

		// Fragment Shaderをコンパイル
		var fs = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(fs, document.getElementById("fs").text);
		gl.compileShader(fs);
		if(!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
			console.log("fragment shader compile error");
			console.log(gl.getShaderInfoLog(fs));
			return;
		}

		// Shaderをリンク
		prog = gl.createProgram();
		gl.attachShader(prog, vs);
		gl.attachShader(prog, fs);
		gl.linkProgram(prog);
		if(!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
			console.log("link error");
			console.log(gl.getShaderInfoLog(fs));
			return;
		}
	}
})();
