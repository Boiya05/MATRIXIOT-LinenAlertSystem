package com.uhf18.scanlable;

import com.uhf18.scanlable.R;
//import com.UHF.scanlable.UHfData.UHfGetData;

import android.os.Bundle;
import android.app.Activity;
import android.app.TabActivity;
import android.content.Intent;
import android.view.Menu;
import android.view.Window;
import android.widget.TabHost;

public class MainActivity extends TabActivity {
	
	private TabHost myTabHost;

	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		requestWindowFeature(Window.FEATURE_NO_TITLE);
		setContentView(R.layout.activity_main);
		myTabHost = getTabHost();
		Intent intent0 = new Intent(this,ScanMode.class);
		Intent intent1 = new Intent(this,ReadWriteActivity.class);
		Intent intent2 = new Intent(this,ScanView.class);
		
		TabHost.TabSpec tabSpec0 = myTabHost.newTabSpec(getString(R.string.tab_scan)).setIndicator(getString(R.string.tab_scan)).setContent(intent0);
		TabHost.TabSpec tabSpec1 = myTabHost.newTabSpec(getString(R.string.tab_rw)).setIndicator(getString(R.string.tab_rw)).setContent(intent1);
		TabHost.TabSpec tabSpec2 = myTabHost.newTabSpec(getString(R.string.tab_param)).setIndicator(getString(R.string.tab_param)).setContent(intent2);

		myTabHost.addTab(tabSpec0);
		myTabHost.addTab(tabSpec1);
		myTabHost.addTab(tabSpec2);
		myTabHost.setCurrentTab(0);
	}

	@Override
	public boolean onCreateOptionsMenu(Menu menu) {
		return true;
	}
	
	@Override
	protected void onPause() {
		// TODO Auto-generated method stub
		super.onPause();
	}
	
	@Override
	protected void onDestroy() {
		// TODO Auto-generated method stub
		super.onPause();
		Reader.rrlib.DisConnect();
	}

}
