package com.sleepypay.app

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.util.AttributeSet
import android.view.View
import android.view.animation.LinearInterpolator
import androidx.core.content.ContextCompat
import kotlin.math.min

/** Dimmed overlay with a rounded scan window, accent corner brackets and a moving scan line. */
class ViewfinderView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : View(context, attrs) {

    private val accent = ContextCompat.getColor(context, R.color.accent)

    private val dim = Paint().apply {
        color = 0xB3000000.toInt()
        style = Paint.Style.FILL
    }
    private val bracket = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = accent
        style = Paint.Style.STROKE
        strokeWidth = dp(4f)
        strokeCap = Paint.Cap.ROUND
    }
    private val scanLine = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = accent
        alpha = 170
        style = Paint.Style.STROKE
        strokeWidth = dp(3f)
        strokeCap = Paint.Cap.ROUND
    }

    private val mask = Path()
    private val corners = Path()
    private val frame = RectF()
    private val arc = RectF()
    private var progress = 0f

    private val animator = ValueAnimator.ofFloat(0f, 1f).apply {
        duration = 1800
        repeatCount = ValueAnimator.INFINITE
        repeatMode = ValueAnimator.REVERSE
        interpolator = LinearInterpolator()
        addUpdateListener {
            progress = it.animatedValue as Float
            invalidate()
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        animator.start()
    }

    override fun onDetachedFromWindow() {
        animator.cancel()
        super.onDetachedFromWindow()
    }

    override fun onDraw(canvas: Canvas) {
        val w = width.toFloat()
        val h = height.toFloat()
        val size = min(w, h) * 0.68f
        val cx = w / 2f
        val cy = h * 0.42f
        frame.set(cx - size / 2f, cy - size / 2f, cx + size / 2f, cy + size / 2f)
        val r = dp(28f)

        mask.reset()
        mask.fillType = Path.FillType.EVEN_ODD
        mask.addRect(0f, 0f, w, h, Path.Direction.CW)
        mask.addRoundRect(frame, r, r, Path.Direction.CW)
        canvas.drawPath(mask, dim)

        val l = frame.left
        val t = frame.top
        val rt = frame.right
        val b = frame.bottom
        val len = dp(40f)

        corners.reset()
        corners.moveTo(l, t + len)
        corners.lineTo(l, t + r)
        arc.set(l, t, l + 2 * r, t + 2 * r)
        corners.arcTo(arc, 180f, 90f)
        corners.lineTo(l + len, t)

        corners.moveTo(rt - len, t)
        corners.lineTo(rt - r, t)
        arc.set(rt - 2 * r, t, rt, t + 2 * r)
        corners.arcTo(arc, 270f, 90f)
        corners.lineTo(rt, t + len)

        corners.moveTo(rt, b - len)
        corners.lineTo(rt, b - r)
        arc.set(rt - 2 * r, b - 2 * r, rt, b)
        corners.arcTo(arc, 0f, 90f)
        corners.lineTo(rt - len, b)

        corners.moveTo(l + len, b)
        corners.lineTo(l + r, b)
        arc.set(l, b - 2 * r, l + 2 * r, b)
        corners.arcTo(arc, 90f, 90f)
        corners.lineTo(l, b - len)
        canvas.drawPath(corners, bracket)

        val pad = dp(24f)
        val y = t + pad + progress * (frame.height() - 2 * pad)
        canvas.drawLine(l + pad, y, rt - pad, y, scanLine)
    }

    private fun dp(v: Float) = v * resources.displayMetrics.density
}
