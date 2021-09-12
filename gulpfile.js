// VARIABLES & PATHS

let preprocessor = 'sass', // Preprocessor (sass, scss, less, styl)
    fileswatch   = 'txt,json,md,woff2', // List of files extensions for watching & hard reload (comma separated)
    imageswatch  = 'jpg,jpeg,png,webp,svg', // List of images extensions for watching & compression (comma separated)
    baseDir      = 'app', // Base directory path without «/» at the end
    online       = true; // If «false» - Browsersync will work offline without internet connection

let paths = {

	scripts: {
		src: [
			baseDir + '/assets/js/' // app.js. Always at the end
		],
		dest: baseDir + '/js/',
	},

	styles: {
		src:  baseDir + '/assets/css' + '/pages/**/*.' + preprocessor,
		dest: baseDir + '/css/',
	},

	images: {
		src:  baseDir + '/assets/imageSrc/**/*',
		dest: baseDir + '/img/',
	},

	fonts: {
		dest: baseDir + '/assets/fonts/'
	},

	templates: {
		src: baseDir + '/assets/templateSrc/*.html',
		dest: baseDir + '/templates/',
		components: baseDir + '/assets/templateSrc/components/*.html'
	},

	deploy: {
		hostname:    'username@yousite.com', // Deploy hostname
		destination: 'yousite/public_html/', // Deploy destination
		include:     [/* '*.htaccess' */], // Included files to deploy
		exclude:     [ '**/Thumbs.db', '**/*.DS_Store' ], // Excluded files from deploy
	},

	build: {
		dest: baseDir + '/dist',
		scriptsDest: baseDir + '/dist/js',
		stylesDest: baseDir + '/dist/css',
		htmlDest: baseDir + '/dist/templates',
		imagesDest: baseDir + '/dist/img',
		fontsDest: baseDir + '/dist/fonts'
	},

}

// LOGIC
import pkg from 'gulp'
const { gulp, src, dest, parallel, series, watch } = pkg

import fs                     from 'fs'
import rimraf                 from 'rimraf'
import browserSync            from 'browser-sync'
import gulpSass               from 'gulp-sass'
import dartSass               from 'sass'
const  sass                   = gulpSass(dartSass)
import cleancss               from 'gulp-clean-css'
import autoprefixer           from 'gulp-autoprefixer'
import imagemin               from 'gulp-imagemin'
import newer                  from 'gulp-newer'
import rsync                  from 'gulp-rsync'
import del                    from 'del'
import webpackStream          from 'webpack-stream'
import webpackConfig          from'./webpack.config.js'
import rev                    from 'gulp-rev'
import revdel                 from 'gulp-rev-delete-original'
import rename                 from 'gulp-rename'
import imageminJpegRecompress from 'imagemin-jpeg-recompress'
import imageminPngquant       from 'imagemin-pngquant'
import fileinclude            from 'gulp-file-include'



// DEVELOPMENT SECTION

function browsersync() {
	browserSync.init({
		server: { baseDir: baseDir + '/' },
		notify: false,
		online: online,
		index: '/templates/mainPage.html'
	})
}


function scripts() {
	// webpack development mode
	webpackConfig.mode = 'development'
	webpackConfig.watch = true

	return src(paths.scripts.src)
		.pipe(webpackStream(webpackConfig))
		.pipe(dest(paths.scripts.dest))
		.pipe(browserSync.stream())
}

function styles() {
	return src(paths.styles.src)
		.pipe(eval(preprocessor)())
		.pipe(rename({dirname: ''})) // remove folders
		.pipe(dest(paths.styles.dest))
		.pipe(browserSync.stream())
}

function images() {
	return src(paths.images.src)
		.pipe(newer(paths.images.dest))
		.pipe(imagemin([
			imageminPngquant({
				quality: [0.5, 0.8]
			}),
			imageminJpegRecompress({
				progressive: true,
				max: 80,
				min: 70
			}),
		]))
		.pipe(dest(paths.images.dest))
}

function html() {
	return src(paths.templates.src)
		.pipe(fileinclude({
			prefix: '@@',
			basepath: '@file'
		}))
		.pipe(dest(paths.templates.dest))
		.pipe(browserSync.stream())
}

function cleanimg() {
	return del('' + paths.images.dest + '/**/*', { force: true })
}

function deploy() {
	return src(baseDir + '/')
	.pipe(rsync({
		root: baseDir + '/',
		hostname: paths.deploy.hostname,
		destination: paths.deploy.destination,
		include: paths.deploy.include,
		exclude: paths.deploy.exclude,
		recursive: true,
		archive: true,
		silent: false,
		compress: true
	}))
}

function startwatch() {
	watch(baseDir  + '/assets/css/**/*', styles);
	watch(baseDir  + '/assets/imageSrc/**/*.{' + imageswatch + '}', images);
	watch(baseDir  + '/**/*.{' + fileswatch + '}').on('change', browserSync.reload);
	watch(baseDir + '/js/*.js', scripts);
	watch(baseDir + '/assets/templateSrc/**/*.html', html);
}


// BUILD SECTION

async function buildDist() {
	if(!fs.existsSync(paths.build.dest)) {
		fs.mkdirSync(paths.build.dest)
	} else {
		rimraf.sync(paths.build.dest) // delete folder
		fs.mkdirSync(paths.build.dest)
	}
}

function buildScripts() {
	// webpack production mode
	webpackConfig.mode = 'production'
	webpackConfig.watch = false

	return src(paths.scripts.dest)
		.pipe(webpackStream(webpackConfig))
		.pipe(dest(paths.build.scriptsDest))
}

function buildStyles() {
	return src(paths.styles.dest + '/*.css')
		.pipe(autoprefixer({ overrideBrowserslist: ['last 10 versions'], grid: true }))
		.pipe(cleancss( {level: { 1: { specialComments: 0 } } }))
		.pipe(dest(paths.build.stylesDest))
}

function hashFiles() {
	return src([paths.build.scriptsDest + '/*.js', paths.build.stylesDest + '/*.css'], {base: paths.build.dest})
		// .pipe(dest(paths.build.dest)) // copy original files to dist
		.pipe(rev())
		.pipe(dest(paths.build.dest)) // write rev'd files
		.pipe(revdel())               // delete original files
		.pipe(rev.manifest())
		.pipe(dest(paths.build.dest))
}

function buildTemplates() {
	return src([paths.templates.dest + '**/*.html', paths.templates.components])
		.pipe(dest(paths.build.htmlDest))
}

function buildImages() {
	return src(paths.images.dest + '**/*')
		.pipe(dest(paths.build.imagesDest))
}

function buildFonts() {
	return src(paths.fonts.dest + '*.woff2')
		.pipe(dest(paths.build.fontsDest))
}



// TASKS SECTION

// exports.browsersync = browsersync;
// exports.assets      = series(cleanimg, styles, scripts, images);
// exports.styles      = styles;
// exports.scripts     = scripts;
// exports.images      = images;
// exports.cleanimg    = cleanimg;
// exports.deploy      = deploy;
export default         parallel(images, styles, scripts, html, browsersync, startwatch)
export let build =     series(buildDist, buildScripts, buildStyles, hashFiles, buildTemplates, buildImages, buildFonts)
