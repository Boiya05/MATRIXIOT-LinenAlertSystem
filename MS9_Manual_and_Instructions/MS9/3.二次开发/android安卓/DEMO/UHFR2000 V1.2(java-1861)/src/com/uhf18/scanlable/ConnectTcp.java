package com.uhf18.scanlable;

import com.uhf18.scanlable.R;
import com.rfid.trans18.UHFLib;

import android.os.Bundle;
import android.os.Handler;
import android.os.Message;
import android.app.Activity;
import android.content.Intent;
import android.view.KeyEvent;
import android.view.Menu;
import android.view.View;
import android.view.View.OnClickListener;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

public class ConnectTcp extends Activity {

	private static final String TAG = "COONECTRS232";
	private static final boolean DEBUG = true;
	private TextView mConectButton;

	private EditText   ipAddr,ipPort;
    private String strIP;
    private String strPort;
    private Handler mHandler;
	private static final int MSG_SHOW_RESULT = 0;
	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		setContentView(R.layout.activity_connect_tcp);
		mHandler = new Handler(){
			@Override
			public void handleMessage(Message msg) {
				// TODO Auto-generated method stub
				super.handleMessage(msg);
				switch (msg.what) {
				case MSG_SHOW_RESULT:
					 mConectButton.setEnabled(true);
					 byte[]buffer = (byte[]) msg.obj;
                     if(buffer[0]==0)
                     {
                    	 Intent intent;
						 intent = new Intent().setClass(ConnectTcp.this, MainActivity.class);
						 startActivity(intent);
                     }
                     else
                     {
                    	 Toast.makeText(getApplication(), getString(R.string.openport_failed), Toast.LENGTH_SHORT).show();
                     }
					break;
				default:
					break;
				}
			}
		};
		
		ipAddr =(EditText)findViewById(R.id.editIp);
		ipPort =(EditText)findViewById(R.id.editPort);
		mConectButton = (TextView) findViewById(R.id.textview_connecttcp);
		mConectButton.setOnClickListener(new OnClickListener() {
			@Override
			public void onClick(View v) {
				try {
					try{
						if(ipAddr.getText().equals(null))strIP="192.168.1.190";
						else strIP=ipAddr.getText().toString();
						
						if(ipPort.getText().equals(null))strPort="6000";
						else strPort=ipPort.getText().toString();
						
					}catch(Exception ex)
					{strIP="192.168.1.190";strPort="6000";}
					final int nPort=Integer.valueOf(strPort);
					mConectButton.setEnabled(false);
					Thread mThread = new Thread(new Runnable() 
					{  
			            @Override  
			            public void run() 
			            {  
			            	byte[]data = new byte[1];
			            	Reader.rrlib = new UHFLib(1);
			            	int result = Reader.rrlib.Connect(strIP, nPort);
			            	data[0] = (byte)(result);
			            	mHandler.obtainMessage(MSG_SHOW_RESULT, 1, -1, data).sendToTarget();
			            }  
			        }); 
					mThread.start();
					
				}catch (Exception e) 
				{
					Toast.makeText(
							getApplicationContext(),
							getString(R.string.openport_failed),
							Toast.LENGTH_SHORT).show();
				}
			}
		});
	}
	



	public boolean onKeyDown(int keyCode, KeyEvent event) {
		if (keyCode == KeyEvent.KEYCODE_BACK) {
			
			finish();

			return true;
		}
		return super.onKeyDown(keyCode, event);
	}
	
	@Override
	protected void onDestroy() {
		// TODO Auto-generated method stub
		super.onDestroy();
	}

}
