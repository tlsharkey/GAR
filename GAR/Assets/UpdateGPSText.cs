using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

public class UpdateGPSText : MonoBehaviour
{
    public Text coordinates;

    private void Update()
    {
        coordinates.text = string.Format("Lat: {0}\nLong: {1}", GPS.Instance.latitude, GPS.Instance.longitude);
    }
}
