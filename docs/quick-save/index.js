(() => {
	// QuickSave: a Save button in the media viewer header, next to the "..." menu.
	// Vendetta-format plugin (Revenge loads it from a URL). The file is evaluated as
	// `vendetta => { return <this file> }`, so it must be a single expression.
	const { metro, patcher, ui, logger, plugin } = vendetta
	const { React, ReactNative: RN } = metro.common
	const { showToast } = ui.toasts
	const { getAssetIDByName } = ui.assets

	const TAG = '[QuickSave]'
	const VIDEO_EXT = ['.mp4', '.webm', '.mov', '.mkv', '.m4v', '.avi']
	// Proxy params that shrink or re-encode the media; removing them gives the original file.
	const RESIZE_PARAMS = ['width', 'height', 'quality', 'format']

	const storage = plugin?.storage ?? {}
	const unpatches = []
	let memoWrapper = null
	let origType = null
	let retryTimer = null

	const isVideo = url => VIDEO_EXT.some(e => url.split('?')[0].toLowerCase().endsWith(e))

	function fullResURL(source) {
		const raw = source.sourceURI || source.uri
		try {
			const url = new URL(raw)
			for (const p of RESIZE_PARAMS) url.searchParams.delete(p)
			// Attachments on the media proxy are also served (unscaled) by the CDN, with the same signature.
			if (url.hostname === 'media.discordapp.net' && url.pathname.startsWith('/attachments/'))
				url.hostname = 'cdn.discordapp.com'
			return url.toString()
		} catch {
			return raw
		}
	}

	function getMediaManager() {
		return metro.findByProps('downloadMediaAsset')
	}

	// The second argument of downloadMediaAsset is a media-type number that is not documented.
	// Defaults: 0 = image, 1 = video. Whenever Discord itself saves something (menu -> Save),
	// the plugin records the number Discord used, so it corrects itself after one manual save.
	function mediaType(video) {
		const learned = video ? storage.videoType : storage.imageType
		return typeof learned === 'number' ? learned : video ? 1 : 0
	}

	async function save(source) {
		const MediaManager = getMediaManager()
		if (!MediaManager) return showToast('QuickSave: brak modułu MediaManager', getAssetIDByName('Small'))

		const url = fullResURL(source)
		const video = Boolean(source.videoURI) || isVideo(url)
		try {
			await MediaManager.downloadMediaAsset(url, mediaType(video))
			showToast('Zapisano', getAssetIDByName('Check'))
		} catch (e) {
			logger.error(TAG, 'save failed', url, e)
			showToast(`Nie udało się zapisać: ${e?.message ?? e}`, getAssetIDByName('Small'))
		}
	}

	function SaveButton({ source }) {
		const icon =
			getAssetIDByName('DownloadIcon') ?? getAssetIDByName('ic_download_24px') ?? getAssetIDByName('ic_file_download')

		return React.createElement(
			RN.TouchableOpacity,
			{
				onPress: () => save(source),
				accessibilityRole: 'button',
				accessibilityLabel: 'Save',
				hitSlop: { top: 10, bottom: 10, left: 10, right: 10 },
				style: { padding: 8, marginHorizontal: 4, justifyContent: 'center', alignItems: 'center' },
			},
			icon
				? React.createElement(RN.Image, { source: icon, style: { width: 24, height: 24, tintColor: '#FFFFFF' } })
				: React.createElement(RN.Text, { style: { color: '#FFFFFF', fontWeight: '600' } }, 'Save'),
		)
	}

	// GIFFavButton (the star) is rendered in the media viewer header for every media item,
	// and gets the current media as `props.source`. It's a React.memo, so we swap its inner type.
	const isGIFFavMemo = m =>
		m?.$$typeof && m.type && (m.type.displayName === 'GIFFavButton' || m.type.name === 'GIFFavButton')

	function findGIFFavButton() {
		try {
			const found = metro.find(isGIFFavMemo)
			if (found) return found
		} catch {}
		const modules = metro.modules ?? window.modules
		for (const id in modules ?? {}) {
			try {
				const exp = modules[id]?.publicModule?.exports
				if (isGIFFavMemo(exp?.default)) return exp.default
				if (isGIFFavMemo(exp)) return exp
			} catch {}
		}
		return null
	}

	function patchHeader() {
		const memo = findGIFFavButton()
		if (!memo) return false

		memoWrapper = memo
		origType = memo.type
		const Original = origType
		function QuickSaveGIFFavButton(props) {
			const original = React.createElement(Original, props)
			if (!props?.source?.uri && !props?.source?.sourceURI) return original
			return React.createElement(React.Fragment, null, original, React.createElement(SaveButton, { source: props.source }))
		}
		QuickSaveGIFFavButton.displayName = 'GIFFavButton'
		memo.type = QuickSaveGIFFavButton
		logger.log(TAG, 'patched media viewer header')
		return true
	}

	function learnMediaTypes() {
		const MediaManager = getMediaManager()
		if (!MediaManager) return
		unpatches.push(
			patcher.before('downloadMediaAsset', MediaManager, args => {
				const [url, type] = args
				if (typeof url !== 'string' || typeof type !== 'number') return
				logger.log(TAG, 'downloadMediaAsset', type, url)
				if (isVideo(url)) storage.videoType = type
				else storage.imageType = type
			}),
		)
	}

	return {
		onLoad() {
			learnMediaTypes()
			if (patchHeader()) return
			// The viewer module can be loaded lazily; keep looking for a while.
			let tries = 0
			retryTimer = setInterval(() => {
				if (patchHeader() || ++tries > 120) {
					clearInterval(retryTimer)
					retryTimer = null
					if (!memoWrapper) logger.error(TAG, 'GIFFavButton not found')
				}
			}, 500)
		},
		onUnload() {
			if (retryTimer) clearInterval(retryTimer)
			retryTimer = null
			if (memoWrapper && origType) memoWrapper.type = origType
			memoWrapper = origType = null
			for (const unpatch of unpatches.splice(0)) unpatch()
		},
	}
})()
