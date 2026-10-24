package com.sleepypay.app

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.EditText
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat

class MainActivity : ComponentActivity() {

    private lateinit var inputCard: View
    private lateinit var payCard: View
    private lateinit var payBar: View
    private lateinit var manual: EditText
    private lateinit var amount: EditText
    private lateinit var inputMsg: TextView
    private lateinit var payMsg: TextView
    private lateinit var payeeName: TextView
    private lateinit var payeeVpa: TextView
    private var currentVpa: String = ""

    private val scanLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { res ->
        val text = res.data?.getStringExtra(ScanActivity.EXTRA_RESULT)
        if (text != null) handleInput(text)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        inputCard = findViewById(R.id.inputCard)
        payCard = findViewById(R.id.payCard)
        payBar = findViewById(R.id.payBar)
        manual = findViewById(R.id.manual)
        amount = findViewById(R.id.amount)
        inputMsg = findViewById(R.id.inputMsg)
        payMsg = findViewById(R.id.payMsg)
        payeeName = findViewById(R.id.payeeName)
        payeeVpa = findViewById(R.id.payeeVpa)

        findViewById<View>(R.id.useManual).setOnClickListener { handleInput(manual.text.toString()) }
        findViewById<View>(R.id.scanBtn).setOnClickListener {
            scanLauncher.launch(Intent(this, ScanActivity::class.java))
        }
        findViewById<View>(R.id.copyVpa).setOnClickListener { copy(currentVpa, getString(R.string.copied_id)) }
        findViewById<View>(R.id.copyAmt).setOnClickListener {
            val a = UpiParser.normalizeAmount(amount.text.toString())
            if (a == null) {
                sayPay(getString(R.string.bad_amount), good = false)
            } else {
                amount.setText(a)
                copy(a, getString(R.string.copied_amount))
            }
        }
        findViewById<View>(R.id.dialBtn).setOnClickListener { openUssd() }
        findViewById<View>(R.id.resetBtn).setOnClickListener { reset() }
    }

    private fun sayPay(text: String, good: Boolean) {
        payMsg.setTextColor(ContextCompat.getColor(this, if (good) R.color.ok else R.color.bad))
        payMsg.text = text
    }

    private fun handleInput(text: String) {
        when (val r = UpiParser.parseAny(text)) {
            is UpiParser.Result.Error -> inputMsg.text = r.message
            is UpiParser.Result.Ok -> {
                inputMsg.text = ""
                showPayment(r.payment)
            }
        }
    }

    private fun showPayment(p: UpiParser.Payment) {
        currentVpa = p.vpa
        payeeName.text = p.name.ifEmpty { getString(R.string.unknown_payee) }
        payeeVpa.text = p.vpa
        amount.setText(p.amount ?: "")
        sayPay(if (p.note.isNotEmpty()) getString(R.string.note_from_qr, p.note) else "", good = true)
        inputCard.visibility = View.GONE
        payCard.visibility = View.VISIBLE
        payBar.visibility = View.VISIBLE
    }

    private fun copy(text: String, okMsg: String) {
        val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        cm.setPrimaryClip(ClipData.newPlainText("Sleepy Pay", text))
        sayPay(okMsg, good = true)
    }

    /** Opens the dialer pre-filled with *99#. The user presses call, so nothing is dialed silently. */
    private fun openUssd() {
        val uri = Uri.parse("tel:" + Uri.encode("*99#"))
        try {
            startActivity(Intent(Intent.ACTION_DIAL, uri))
        } catch (e: ActivityNotFoundException) {
            sayPay(getString(R.string.no_dialer), good = false)
        }
    }

    private fun reset() {
        payCard.visibility = View.GONE
        payBar.visibility = View.GONE
        inputCard.visibility = View.VISIBLE
        manual.setText("")
        amount.setText("")
        payMsg.text = ""
        inputMsg.text = ""
        currentVpa = ""
    }
}
