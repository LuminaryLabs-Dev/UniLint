using UnityEngine;

public sealed class GoodComponent : MonoBehaviour
{
#if FIXTURE_UNITY_6
    public const string TargetFamily = "Unity6";
#else
    public const string TargetFamily = "Legacy";
#endif
}
