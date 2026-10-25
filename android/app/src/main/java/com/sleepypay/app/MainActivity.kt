package com.sleepypay.app

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.animation.DecelerateInterpolator
import android.widget.EditText
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : ComponentActivity() {

    private enum class State { HOME, PAY, DONE }

    private lateinit var scroll: ScrollView
    private lateinit var inputCard: View
    private lateinit var payCard: View
    private lateinit var doneCard: View
    private lateinit var payBar: View
    private lateinit var rowNote: View
    private lateinit var manual: EditText
    private lateinit var amount: EditText
    private lateinit var inputMsg: TextView
    private lateinit var payMsg: TextView
    private lateinit var payeeInitial: TextView
    private lateinit var payeeName: TextView
    private lateinit var payeeVpa: TextView
    private lateinit var payNote: TextView
    private lateinit var doneName: TextView
    private lateinit var doneVpa: TextView
    private lateinit var doneAmount: TextView
    private lateinit var doneTime: TextView
    private lateinit var doneDate: TextView

    private var state = State.HOME
    private var currentVpa: String = ""

    private val scanLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { res ->
        val text = res.data?.getStringExtra(ScanActivity.EXTRA_RESULT)
        if (text != null) handleInput(text)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        scroll = findViewById(R.id.scroll)
        inputCard = findViewById(R.id.inputCard)
        payCard = findViewById(R.id.payCard)
        doneCard = findViewById(R.id.doneCard)
        payBar = findViewById(R.id.payBar)
        rowNote = findViewById(R.id.rowNote)
        manual = findViewById(R.id.manual)
        amount = findViewById(R.id.amount)
        inputMsg = findViewById(R.id.inputMsg)
        payMsg = findViewById(R.id.payMsg)
        payeeInitial = findViewById(R.id.payeeInitial)
        payeeName = findViewById(R.id.payeeName)
        payeeVpa = findViewById(R.id.payeeVpa)
        payNote = findViewById(R.id.payNote)
        doneName = findViewById(R.id.doneName)
        doneVpa = findViewById(R.id.doneVpa)
        doneAmount = findViewById(R.id.doneAmount)
        doneTime = findViewById(R.id.doneTime)
        doneDate = findViewById(R.id.doneDate)

        findViewById<View>(R.id.useManual).setOnClickListener { handleInput(manual.text.toString()) }
        findViewById<View>(R.id.scanBtn).setOnClickListener {
            scanLauncher.launch(Intent(this, ScanActivity::class.java))
        }
        findViewById<View>(R.id.backBtn).setOnClickListener { reset() }
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
        findViewById<View>(R.id.paidBtn).setOnClickListener { markPaid() }
        findViewById<View>(R.id.doneBtn).setOnClickListener { reset() }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (state != State.HOME) {
                    reset()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    private fun show(next: State) {
        state = next
        inputCard.visibility = if (next == State.HOME) View.VISIBLE else View.GONE
        payCard.visibility = if (next == State.PAY) View.VISIBLE else View.GONE
        doneCard.visibility = if (next == State.DONE) View.VISIBLE else View.GONE
        payBar.visibility = if (next == State.PAY) View.VISIBLE else View.GONE
        scroll.scrollTo(0, 0)

        val shown = when (next) {
            State.HOME -> inputCard
            State.PAY -> payCard
            State.DONE -> doneCard
        }
        shown.alpha = 0f
        shown.translationY = 32f
        shown.animate().alpha(1f).translationY(0f).setDuration(280)
            .setInterpolator(DecelerateInterpolator()).start()

        if (next == State.PAY) {
            payBar.alpha = 0f
            payBar.translationY = 120f
            payBar.animate().alpha(1f).translationY(0f).setDuration(320).setStartDelay(60)
                .setInterpolator(DecelerateInterpolator()).start()
        }
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
        payeeInitial.text = (p.name.firstOrNull() ?: p.vpa.first()).uppercaseChar().toString()
        amount.setText(p.amount ?: "")
        if (p.note.isNotEmpty()) {
            payNote.text = p.note
            rowNote.visibility = View.VISIBLE
        } else {
            rowNote.visibility = View.GONE
        }
        payMsg.text = ""
        show(State.PAY)
        payCard.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK)
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

    /** The app can't see the bank's result, so this screen only records what the user says. */
    private fun markPaid() {
        val a = UpiParser.normalizeAmount(amount.text.toString())
        if (a == null) {
            sayPay(getString(R.string.bad_amount), good = false)
            return
        }
        val now = Date()
        doneName.text = payeeName.text
        doneVpa.text = currentVpa
        doneAmount.text = "₹" + a
        doneTime.text = SimpleDateFormat("hh:mm a", Locale.getDefault()).format(now)
        doneDate.text = SimpleDateFormat("d MMM yyyy", Locale.getDefault()).format(now)
        show(State.DONE)
        doneCard.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK)
    }

    private fun reset() {
        manual.setText("")
        amount.setText("")
        payMsg.text = ""
        inputMsg.text = ""
        currentVpa = ""
        show(State.HOME)
    }
}
