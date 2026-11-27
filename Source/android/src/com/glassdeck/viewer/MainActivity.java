package com.glassdeck.viewer;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.text.InputFilter;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.webkit.CookieManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public final class MainActivity extends Activity {
    private static final String CONNECTION = "wifi-connection-v2";
    private static final String SERVER = "server";
    private static final int INK = 0xffeff5ff;
    private static final int MUTED = 0xffa9b9d6;
    private String host;
    private String blockedMessage;
    private FrameLayout root;
    private WebView display;
    private EditText address;
    private EditText pairCode;
    private TextView message;
    private Button connect;
    private boolean connecting;
    private int attempt;

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        getWindow().setStatusBarColor(0xff0b1427);
        getWindow().setNavigationBarColor(0xff0b1427);
        host = getSharedPreferences(CONNECTION, MODE_PRIVATE).getString(SERVER, "");
        if (host.isEmpty()) showPairForm("");
        else openDisplay(host);
    }

    private int dp(int n) {
        return Math.round(n * getResources().getDisplayMetrics().density);
    }

    private GradientDrawable rounded(int color, int border, int radius) {
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(color);
        bg.setCornerRadius(dp(radius));
        if (border != 0) bg.setStroke(dp(1), border);
        return bg;
    }

    private void systemBars(boolean immersive) {
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(!immersive);
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                if (immersive) controller.hide(WindowInsets.Type.systemBars());
                else controller.show(WindowInsets.Type.systemBars());
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(immersive ? 5894 : 0);
        }
    }

    private TextView text(String value, int size, int color) {
        TextView text = new TextView(this);
        text.setText(value);
        text.setTextSize(size);
        text.setTextColor(color);
        return text;
    }

    private void add(LinearLayout column, View child, int top) {
        LinearLayout.LayoutParams item = new LinearLayout.LayoutParams(-1, -2);
        item.topMargin = dp(top);
        column.addView(child, item);
    }

    private EditText field(String hint, int inputType) {
        EditText box = new EditText(this);
        box.setSingleLine(true);
        box.setTextColor(INK);
        box.setTextSize(16);
        box.setHintTextColor(MUTED);
        box.setHint(hint);
        box.setInputType(inputType);
        box.setPadding(dp(12), dp(8), dp(12), dp(8));
        box.setMinHeight(dp(43));
        box.setBackground(rounded(0xff0b1428, 0xff334768, 8));
        return box;
    }

    private void showPairForm(String reason) {
        attempt++;
        connecting = false;
        blockedMessage = null;

        if (display != null) {
            display.stopLoading();
            if (display.getParent() instanceof android.view.ViewGroup) {
                ((android.view.ViewGroup) display.getParent()).removeView(display);
            }
            display.destroy();
            display = null;
        }
        root = new FrameLayout(this);
        root.setBackground(new GradientDrawable(GradientDrawable.Orientation.TL_BR,
                new int[]{0xff203a65, 0xff0c1427, 0xff101b33}));
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(18), dp(16), dp(18), dp(16));
        card.setBackground(rounded(0xff142039, 0xff5876a3, 14));
        FrameLayout.LayoutParams fit = new FrameLayout.LayoutParams(
                Math.min(dp(430), getResources().getDisplayMetrics().widthPixels - dp(34)), -2, Gravity.CENTER);
        root.addView(card, fit);
        setContentView(root);

        systemBars(false);
        TextView brand = text("GlassDeck Profiles", 25, INK);
        brand.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        add(card, brand, 0);
        add(card, text("Choose your GlassDeck profile by entering the laptop address.", 13, MUTED), 3);
        address = field("Windows address, e.g. 192.168.1.2:38423", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        address.setContentDescription("Windows address");
        address.setText(host.replaceFirst("^http://", ""));
        add(card, address, 10);
        connect = new Button(this);
        connect.setAllCaps(false);
        connect.setText("Open GlassDeck profile");
        connect.setTextColor(0xff132344);
        connect.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        connect.setBackground(rounded(0xffb4d3ff, 0, 9));
        connect.setMinHeight(dp(43));
        connect.setOnClickListener(view -> pair());
        add(card, connect, 8);
        message = text(reason, 13, MUTED);
        message.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        message.setVisibility(reason.isEmpty() ? View.GONE : View.VISIBLE);
        add(card, message, 7);
        card.setFocusableInTouchMode(true);
        card.requestFocus();
    }

    static String localAddress(String input) {
        String value = input.trim().replaceFirst("^http://", "");
        if (!value.matches("[0-9.]+(:[0-9]{1,5})?")) return null;
        String[] parts = value.split(":");
        String[] octets = parts[0].split("\\.", -1);
        if (octets.length != 4) return null;
        int[] ip = new int[4];
        for (int i = 0; i < 4; i++) {
            if (!octets[i].matches("0|[1-9][0-9]{0,2}")) return null;
            ip[i] = Integer.parseInt(octets[i]);
            if (ip[i] > 255) return null;
        }
        boolean local = ip[0] == 10 || (ip[0] == 192 && ip[1] == 168)
                || (ip[0] == 172 && ip[1] >= 16 && ip[1] <= 31)
                || (ip[0] == 169 && ip[1] == 254) || "127.0.0.1".equals(parts[0]);
        int port = parts.length == 2 ? Integer.parseInt(parts[1]) : 38423;
        if (!local || port < 1 || port > 65535) return null;
        return "http://" + parts[0] + ":" + port;
    }

    private void status(String value) {
        message.setText(value);
        message.setVisibility(View.VISIBLE);
    }

    private void pair() {
        if (connecting) return;
        String connection = localAddress(address.getText().toString());
        if (connection == null) { status("Enter the laptop's local address."); return; }
        ((InputMethodManager) getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(address.getWindowToken(), 0);
        connecting = true;
        connect.setEnabled(false);
        status("Connecting to Windows…");
        int pending = ++attempt;
        new Thread(() -> {
            HttpURLConnection request = null;
            try {
                request = (HttpURLConnection) new URL(connection + "/api/tablet-health").openConnection();
                request.setConnectTimeout(5000);
                request.setReadTimeout(5000);
                if(request.getResponseCode()!=200 || !"GlassDeck".equals(request.getHeaderField("X-Display"))) throw new IOException();
                runOnUiThread(() -> {
                    if (pending != attempt || isFinishing()) return;
                    host = connection;
                    getSharedPreferences(CONNECTION, MODE_PRIVATE).edit().putString(SERVER, host).apply();
                    openDisplay(host);
                });
            } catch (IOException error) {
                runOnUiThread(() -> failedPair(pending, "Could not reach Windows. Check the address and Wi-Fi."));
            } finally {
                if (request != null) request.disconnect();
            }
        }, "GlassDeck pairing").start();
    }

    private void failedPair(int pending, String reason) {
        if (pending != attempt || isFinishing()) return;
        connecting = false;
        connect.setEnabled(true);
        status(reason);
    }

    private boolean ownUrl(Uri uri, String connection) {
        return "http".equals(uri.getScheme()) && connection.equals("http://" + uri.getEncodedAuthority());
    }

    private void openDisplay(String connection) {
        connecting = false;
        root = new FrameLayout(this);
        display = new WebView(this);
        display.setBackgroundColor(0xff050914);
        display.setOverScrollMode(View.OVER_SCROLL_NEVER);
        display.setVerticalScrollBarEnabled(false);
        display.setHorizontalScrollBarEnabled(false);
        display.getSettings().setJavaScriptEnabled(true);
        display.getSettings().setUseWideViewPort(true);
        display.getSettings().setTextZoom(100);
        display.getSettings().setAllowFileAccess(false);
        display.getSettings().setAllowContentAccess(false);
        display.getSettings().setSupportZoom(false);
        display.getSettings().setBuiltInZoomControls(false);
        display.getSettings().setDisplayZoomControls(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(display, false);
        display.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView web, WebResourceRequest request) {
                if (!ownUrl(request.getUrl(), connection)) return true;
                if (request.isForMainFrame() && "/connect".equals(request.getUrl().getPath())) {
                    web.post(() -> showPairForm("Enter a fresh code from Windows to reconnect."));
                    return true;
                }
                return false;
            }
            @Override public void onReceivedError(WebView web, WebResourceRequest req, WebResourceError error) {
                if (req.isForMainFrame()) onFailure(web, "Could not reach Windows. Check the address and Wi-Fi.");
            }
            @Override public void onReceivedHttpError(WebView web, WebResourceRequest req, WebResourceResponse response) {
                if (req.isForMainFrame()) onFailure(web, "Windows refused the display connection.");
            }
        });
        root.addView(display, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        systemBars(true);
        display.getSettings().setDomStorageEnabled(true);
        display.loadUrl(connection + "/tablet");
        monitor();
    }

    private void onFailure(WebView web, String reason) {
        if (display == web) standby(true);
    }

    @Override public void onWindowFocusChanged(boolean focused) {
        super.onWindowFocusChanged(focused);
        if (focused && display != null) systemBars(true);
    }

    private static final String USB = "http://127.0.0.1:38422";
    private final android.os.Handler handler = new android.os.Handler(android.os.Looper.getMainLooper());
    private boolean dark, busy, active;
    private int misses;
    private final Runnable poll = this::monitor;

    private void standby(boolean offline) {
        if (dark == offline || display == null) return;
        dark = offline;
        root.setBackgroundColor(Color.BLACK);
        display.setVisibility(offline ? View.INVISIBLE : View.VISIBLE);
        WindowManager.LayoutParams params = getWindow().getAttributes();
        params.screenBrightness = offline ? 0f : -1f;
        getWindow().setAttributes(params);
        if (!offline) display.loadUrl(host + "/tablet");
    }

    private void monitor() {
        handler.removeCallbacks(poll);
        if (!active || busy || display == null || host.isEmpty()) return;
        final String endpoint = host;
        final String cookie = CookieManager.getInstance().getCookie(endpoint);
        busy = true;
        new Thread(() -> {
            HttpURLConnection req = null;
            boolean reachable = false;
            try {
                req = (HttpURLConnection)new URL(endpoint + "/api/tablet-health").openConnection();
                if (cookie != null) req.setRequestProperty("Cookie", cookie);
                req.setConnectTimeout(1800);
                req.setReadTimeout(1800);
                reachable = req.getResponseCode() == 200 && "GlassDeck".equals(req.getHeaderField("X-Display"));
            } catch (IOException ignored) {} finally { if (req != null) req.disconnect(); }
            final boolean online = reachable;
            runOnUiThread(() -> {
                busy = false;
                if (!active || isDestroyed()) return;
                misses = online ? 0 : misses + 1;
                if (online || misses >= 2) standby(!online);
                handler.postDelayed(poll, 3500);
            });
        }, "GlassDeck presence").start();
    }

    @Override protected void onResume() { super.onResume(); active = true; monitor(); }
    @Override protected void onPause() { active = false; handler.removeCallbacks(poll); super.onPause(); }

    @Override public void onBackPressed() {
        new android.app.AlertDialog.Builder(this).setItems(new String[]{"Return to display","Use regular Android","Choose profile"}, (dialog, choice) -> {
            if (choice == 1) startActivity(new android.content.Intent(android.provider.Settings.ACTION_HOME_SETTINGS));
            if (choice == 2) { standby(false); showPairForm(""); }
        }).show();
    }
}
