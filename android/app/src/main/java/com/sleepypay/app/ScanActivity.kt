package com.sleepypay.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.HapticFeedbackConstants
import android.view.View
import android.widget.ImageButton
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/** Full-screen QR scanner with a viewfinder and torch. Decodes on-device, so it works with no internet. */
class ScanActivity : ComponentActivity() {

    companion object {
        const val EXTRA_RESULT = "result"
    }

    private lateinit var previewView: PreviewView
    private lateinit var torchBtn: ImageButton
    private lateinit var executor: ExecutorService
    private val done = AtomicBoolean(false)
    private var torchOn = false

    private val permission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) startCamera() else {
            Toast.makeText(this, R.string.camera_denied, Toast.LENGTH_LONG).show()
            finish()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_scan)
        previewView = findViewById(R.id.preview)
        torchBtn = findViewById(R.id.torchBtn)
        executor = Executors.newSingleThreadExecutor()

        findViewById<View>(R.id.backBtn).setOnClickListener { finish() }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            startCamera()
        } else {
            permission.launch(Manifest.permission.CAMERA)
        }
    }

    @androidx.annotation.OptIn(androidx.camera.core.ExperimentalGetImage::class)
    private fun startCamera() {
        val providerFuture = ProcessCameraProvider.getInstance(this)
        providerFuture.addListener({
            val provider = providerFuture.get()
            val preview = Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }

            val scanner = BarcodeScanning.getClient(
                BarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build()
            )

            val analysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
            analysis.setAnalyzer(executor) { proxy ->
                val media = proxy.image
                if (media == null || done.get()) {
                    proxy.close()
                    return@setAnalyzer
                }
                val image = InputImage.fromMediaImage(media, proxy.imageInfo.rotationDegrees)
                scanner.process(image)
                    .addOnSuccessListener { codes ->
                        val raw = codes.firstNotNullOfOrNull { it.rawValue }
                        if (raw != null && raw.startsWith("upi://", ignoreCase = true) && done.compareAndSet(false, true)) {
                            previewView.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK)
                            setResult(RESULT_OK, Intent().putExtra(EXTRA_RESULT, raw))
                            finish()
                        }
                    }
                    .addOnCompleteListener { proxy.close() }
            }

            provider.unbindAll()
            val camera = provider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis)

            if (camera.cameraInfo.hasFlashUnit()) {
                torchBtn.setOnClickListener {
                    torchOn = !torchOn
                    camera.cameraControl.enableTorch(torchOn)
                    torchBtn.alpha = if (torchOn) 1f else 0.6f
                }
            } else {
                torchBtn.visibility = View.GONE
            }
        }, ContextCompat.getMainExecutor(this))
    }

    override fun onDestroy() {
        super.onDestroy()
        executor.shutdown()
    }
}
