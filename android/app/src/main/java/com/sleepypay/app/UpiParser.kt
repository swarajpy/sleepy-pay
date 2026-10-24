package com.sleepypay.app

import java.math.BigDecimal
import java.net.URLDecoder

/** Parses UPI payment links (what merchant QR codes contain). Pure Kotlin so it is unit-testable. */
object UpiParser {

    data class Payment(
        val vpa: String,
        val name: String,
        val amount: String?,
        val note: String,
    )

    sealed class Result {
        data class Ok(val payment: Payment) : Result()
        data class Error(val message: String) : Result()
    }

    private val VPA = Regex("^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$")
    private val AMOUNT = Regex("^\\d+(\\.\\d{1,2})?$")

    fun isValidVpa(value: String): Boolean = VPA.matches(value)

    /** Returns the amount with exactly 2 decimals, or null if it is invalid or not positive. */
    fun normalizeAmount(value: String): String? {
        val s = value.trim()
        if (!AMOUNT.matches(s)) return null
        val n = BigDecimal(s)
        if (n.signum() <= 0) return null
        return n.setScale(2).toPlainString()
    }

    fun parseLink(text: String): Result {
        val raw = text.trim()
        if (!raw.startsWith("upi://pay?", ignoreCase = true)) {
            return Result.Error("Not a UPI payment link")
        }
        val params = try {
            raw.substring(raw.indexOf('?') + 1)
                .split('&')
                .filter { it.isNotEmpty() }
                .associate { part ->
                    val i = part.indexOf('=')
                    if (i < 0) part to ""
                    else part.substring(0, i) to URLDecoder.decode(part.substring(i + 1), "UTF-8")
                }
        } catch (e: IllegalArgumentException) {
            return Result.Error("Could not read the QR code")
        }

        val vpa = (params["pa"] ?: "").trim()
        if (!isValidVpa(vpa)) return Result.Error("Missing or invalid UPI ID")

        var amount: String? = null
        val am = params["am"]
        if (am != null && am.isNotBlank()) {
            amount = normalizeAmount(am) ?: return Result.Error("Invalid amount in QR code")
        }
        return Result.Ok(
            Payment(
                vpa = vpa,
                name = (params["pn"] ?: "").trim(),
                amount = amount,
                note = (params["tn"] ?: "").trim(),
            )
        )
    }

    /** Accepts a upi:// link or a bare UPI ID typed or pasted by the user. */
    fun parseAny(text: String): Result {
        val t = text.trim()
        if (t.startsWith("upi://", ignoreCase = true)) return parseLink(t)
        if (isValidVpa(t)) return Result.Ok(Payment(t, "", null, ""))
        return Result.Error("Enter a UPI ID like name@bank, or scan a UPI QR code")
    }
}
